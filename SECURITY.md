# SECURITY GUIDE - The Weather Archive

This document outlines security practices, secret management, and access control for The Weather Archive project.

---

## 1. Secret Management

### Environment Variables (Lambda)

All secrets are stored as Lambda environment variables, NOT in code.

| Secret | Lambda(s) | Purpose |
|--------|-----------|---------|
| `DATABASE_URL` | All 4 | PostgreSQL connection string |
| `REDIS_URL` | api-lambda | Upstash Redis connection |
| `S3_BUCKET_NAME` | webcams, video | Target S3 bucket |
| `AWS_REGION` | webcams, picture, video | AWS region for S3 URLs |
| `ALLOWED_ORIGIN` | webcams | CORS allowed origin |

### Never Commit Secrets

The following are in `.gitignore`:
```
.env
.env.local
*.pem
*credentials*
```

Use `.env.example` as a template with placeholder values.

---

## 2. API Key Authentication

### How API Keys Work

1. Keys stored in PostgreSQL `api_keys` table
2. Webcams linked to keys via `webcams.api_key_id`
3. Client sends key in `x-api-key` header
4. Lambda validates against database

### Database Schema

```sql
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE webcams (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id),
    api_key_id INTEGER REFERENCES api_keys(id),
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Key Validation Flow

```
Request with x-api-key header
         │
         ▼
┌─────────────────────────────────┐
│ Check: Is header present?       │
│ No → 401 Missing API Key        │
└────────────┬────────────────────┘
             │ Yes
             ▼
┌─────────────────────────────────┐
│ SELECT FROM webcams             │
│ WHERE api_key_id =              │
│   (SELECT id FROM api_keys      │
│    WHERE api_key = $1)          │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Check: Row found?               │
│ No → 403 Unauthorized           │
│ Yes → Continue with city_id     │
└─────────────────────────────────┘
```

---

## 3. Key Rotation Procedure

### Step 1: Generate New Key

```sql
-- Generate a new UUID-based key
INSERT INTO api_keys (api_key)
VALUES (gen_random_uuid()::text)
RETURNING api_key;
```

### Step 2: Update Webcam Association

```sql
-- Link webcam to new key
UPDATE webcams
SET api_key_id = (SELECT id FROM api_keys WHERE api_key = 'NEW_KEY')
WHERE id = WEBCAM_ID;
```

### Step 3: Update Client Configuration

Distribute the new key to the webcam client securely.

### Step 4: Revoke Old Key

```sql
-- After confirming new key works, delete old key
DELETE FROM api_keys WHERE api_key = 'OLD_KEY';
```

---

## 4. CORS Security

### Webcams API CORS

```javascript
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ||
  "https://weather-project-frontend-direncan.s3.us-east-1.amazonaws.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,  // Specific origin, not *
  "Access-Control-Allow-Headers": "Content-Type,x-api-key,X-Api-Key",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
  "Access-Control-Max-Age": "86400"
};
```

### Public API CORS

```javascript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",  // Public read access
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Expose-Headers": "x-cache"
};
```

---

## 5. Database Security

### Connection String Format

```
postgres://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

### SSL/TLS Enforcement

```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  // Required for RDS
});
```

### Prepared Statements (SQL Injection Prevention)

All queries use parameterized queries:

```javascript
// SAFE - parameterized
await pool.query(
  "SELECT * FROM cities WHERE name ILIKE $1",
  [`%${searchQuery}%`]
);

// UNSAFE - never do this
// await pool.query(`SELECT * FROM cities WHERE name = '${searchQuery}'`);
```

---

## 6. S3 Security

### Bucket Policy Recommendations

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadForVideos",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::BUCKET_NAME/videos/*"
    },
    {
      "Sid": "PublicReadForProcessed",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::BUCKET_NAME/processed/*"
    }
  ]
}
```

### Lambda IAM Permissions

Each Lambda needs specific S3 permissions:

| Lambda | S3 Actions | Paths |
|--------|------------|-------|
| webcams | PutObject | photos/* |
| picture | GetObject, PutObject | photos/*, processed/* |
| video | GetObject, PutObject | processed/*, videos/* |

---

## 7. Redis Security

### Upstash Redis Connection

```
rediss://default:PASSWORD@HOSTNAME:PORT
```

- Uses `rediss://` (TLS-encrypted connection)
- Password stored in environment variable
- Connection validated on Lambda startup

### Fallback on Redis Failure

```javascript
const safeRedisGet = async (key) => {
  try {
    return await redis.get(key);
  } catch (err) {
    console.warn('Redis GET error, falling back to DB:', err.message);
    return null;  // Graceful degradation
  }
};
```

---

## 8. Security Checklist

### Code Security
- [x] No hardcoded secrets in source code
- [x] Parameterized SQL queries (no SQL injection)
- [x] API key authentication for write endpoints
- [x] CORS configured with specific origins (webcams)
- [x] Error messages don't expose internal details

### Infrastructure Security
- [ ] S3 bucket has appropriate public access settings
- [ ] Lambda functions have least-privilege IAM roles
- [ ] RDS is in private subnet (VPC)
- [ ] API Gateway has rate limiting enabled
- [ ] CloudWatch logs don't contain sensitive data

### Operational Security
- [ ] API keys rotated periodically
- [ ] Access logs reviewed
- [ ] Unused API keys revoked
- [ ] SSL/TLS enforced for all connections

---

## 9. Incident Response

### Suspected Key Compromise

1. **Immediately revoke the key:**
   ```sql
   DELETE FROM api_keys WHERE api_key = 'COMPROMISED_KEY';
   ```

2. **Check access logs:**
   ```bash
   aws logs filter-log-events \
     --log-group-name /aws/lambda/courseproject-webcams \
     --filter-pattern "COMPROMISED_KEY" \
     --region us-east-1
   ```

3. **Generate and distribute new key**

4. **Review uploaded data for anomalies**

### Suspected Database Breach

1. Rotate database password
2. Update `DATABASE_URL` in all Lambda env vars
3. Review query logs for suspicious activity
4. Consider invalidating Redis cache

---

## 10. Contacts

| Role | Contact |
|------|---------|
| Project Owner | [Your contact] |
| AWS Account Admin | [Admin contact] |
| Security Issues | [Security contact] |

---

*Last updated: 2025-12-28*
