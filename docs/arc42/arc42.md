# Arc42 Architecture Documentation - The Weather Archive

## 1. Introduction and Goals

### 1.1 Requirements Overview

The Weather Archive is a serverless web application that collects weather data and images from webcams, processes them, and presents timelapse videos with weather plots to users.

**Core Features:**
- Webcams POST images + weather metadata via REST API (authenticated)
- Users search for cities and view weather data + timelapse videos
- Automatic image processing (resize/compress)
- Scheduled video generation from collected images
- Redis caching for performance

### 1.2 Quality Goals

| Priority | Goal | Description |
|----------|------|-------------|
| 1 | Performance | API responses < 500ms via Redis cache |
| 2 | Scalability | Serverless architecture handles variable load |
| 3 | Security | API key authentication, no hardcoded secrets |
| 4 | Reliability | Idempotent operations prevent duplicates |

### 1.3 Stakeholders

| Role | Expectations |
|------|--------------|
| End Users | Search cities, view videos and weather plots |
| Webcam Operators | POST images/data via authenticated API |
| Developers | Clean, maintainable serverless code |
| Course Instructor | Working demo, documentation, code quality |

---

## 2. Architecture Constraints

### 2.1 Technical Constraints

| Constraint | Description |
|------------|-------------|
| AWS Lambda | All backend logic runs as Lambda functions |
| PostgreSQL (RDS) | Relational database for metadata |
| Redis (Upstash) | Caching layer for API responses |
| S3 | Object storage for images and videos |
| No frontend framework | Vanilla HTML/CSS/JS only |

### 2.2 Organizational Constraints

| Constraint | Description |
|------------|-------------|
| Course deadline | Must be completed within semester |
| 5-min demo video | Required deliverable |
| Arc42 template | Required documentation format |

---

## 3. System Scope and Context

### 3.1 Business Context

```
┌─────────────┐     HTTP/REST      ┌─────────────────────┐
│   Webcam    │ ─────────────────> │  The Weather Archive│
│  Operators  │   POST /photo      │       (AWS)         │
└─────────────┘   POST /weather    └─────────────────────┘
                                            │
                                            │ HTTP/REST
                                            ▼
                                   ┌─────────────────────┐
                                   │    End Users        │
                                   │   (Web Browser)     │
                                   └─────────────────────┘
```

### 3.2 Technical Context

| External System | Protocol | Purpose |
|-----------------|----------|---------|
| Web Browser | HTTPS | Frontend SPA |
| Webcam Clients | HTTPS + API Key | Image/data ingestion |
| Upstash Redis | TLS | Response caching |
| AWS RDS | PostgreSQL | Data persistence |
| AWS S3 | HTTPS | Object storage |

---

## 4. Solution Strategy

| Decision | Rationale |
|----------|-----------|
| Serverless (Lambda) | Pay-per-use, auto-scaling, no server management |
| API Gateway + Lambda | RESTful API with CORS support |
| S3 triggers | Automatic image processing on upload |
| EventBridge schedule | Periodic video generation |
| Redis cache | Reduce DB load, improve response times |
| Hash routing (SPA) | No server needed for frontend routing |

---

## 5. Building Block View

### 5.1 Level 1: System Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                        The Weather Archive                         │
├───────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │  Frontend   │  │  API Lambda │  │   Webcams   │  │  Picture  │ │
│  │  (Static)   │  │  (Public)   │  │   Lambda    │  │  Lambda   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘ │
│                                                      ┌───────────┐ │
│                                                      │   Video   │ │
│                                                      │  Lambda   │ │
│                                                      └───────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

### 5.2 Level 2: Component Details

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Frontend | `/Frontend/` | SPA with search, autocomplete, video player, charts |
| API Lambda | `/last/last/courseproject-api/` | GET /cities, /videos, /weather, /photos with caching |
| Webcams Lambda | `/last/last/courseproject-webcams/` | POST /photo, /weather with API key auth |
| Picture Lambda | `/last/last/courseproject-picturelambda/` | S3-triggered resize/compress |
| Video Lambda | `/last/last/courseproject-videolambda/` | Scheduled video generation |

---

## 6. Runtime View

### 6.1 Scenario: User Searches for City

```
User          Frontend        API Gateway      API Lambda       Redis        PostgreSQL
 │               │                │                │              │              │
 │─ type "vie" ─>│                │                │              │              │
 │               │── GET /cities ─>│                │              │              │
 │               │                │── invoke ──────>│              │              │
 │               │                │                │── GET key ──>│              │
 │               │                │                │<─ MISS ──────│              │
 │               │                │                │── SELECT ────────────────────>│
 │               │                │                │<─ rows ──────────────────────│
 │               │                │                │── SET key ──>│              │
 │               │                │<─ JSON ────────│              │              │
 │               │<─ autocomplete─│                │              │              │
 │<─ dropdown ──│                │                │              │              │
```

### 6.2 Scenario: Webcam Uploads Photo

```
Webcam        API Gateway      Webcams Lambda      S3           PostgreSQL    Picture Lambda
 │                │                 │               │                │              │
 │─ POST /photo ─>│                 │               │                │              │
 │ + x-api-key   │── invoke ───────>│               │                │              │
 │               │                 │── validate ────────────────────>│              │
 │               │                 │<─ webcam row ──────────────────│              │
 │               │                 │── PutObject ──>│                │              │
 │               │                 │── INSERT ─────────────────────>│              │
 │               │<─ 200 OK ───────│               │                │              │
 │<─ success ────│                 │               │                │              │
 │               │                 │               │── S3 event ────────────────────>│
 │               │                 │               │                │              │── resize
 │               │                 │               │<─ PutObject (processed/) ─────│
 │               │                 │               │                │<─ UPDATE ────│
```

---

## 7. Deployment View

### 7.1 AWS Infrastructure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AWS Account                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐   │
│  │   API Gateway   │     │  Lambda (x4)    │     │       S3        │   │
│  │  (REST API)     │────>│  - api          │────>│  - photos/      │   │
│  │  + CORS         │     │  - webcams      │     │  - processed/   │   │
│  └─────────────────┘     │  - picture      │     │  - videos/      │   │
│                          │  - video        │     └─────────────────┘   │
│                          └─────────────────┘                            │
│                                  │                                       │
│                                  ▼                                       │
│  ┌─────────────────┐     ┌─────────────────┐                            │
│  │  EventBridge    │     │      RDS        │                            │
│  │  (60 min rule)  │     │  (PostgreSQL)   │                            │
│  └─────────────────┘     └─────────────────┘                            │
│                                                                          │
│  ┌─────────────────┐                                                    │
│  │   CloudWatch    │                                                    │
│  │   (Logs)        │                                                    │
│  └─────────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│  Upstash Redis  │  (External - managed Redis)
│  (Cache)        │
└─────────────────┘
```

### 7.2 Environment Variables

| Lambda | Required Variables |
|--------|-------------------|
| api | DATABASE_URL, REDIS_URL |
| webcams | DATABASE_URL, S3_BUCKET_NAME, AWS_REGION |
| picture | DATABASE_URL, AWS_REGION |
| video | DATABASE_URL, S3_BUCKET_NAME, AWS_REGION |

---

## 8. Crosscutting Concepts

### 8.1 CORS (Cross-Origin Resource Sharing)

All API responses include:
```javascript
headers: {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
}
```

OPTIONS preflight handled in webcams lambda.

### 8.2 API Key Authentication

- Webcam endpoints require `x-api-key` header
- Keys stored in `api_keys` PostgreSQL table
- Webcams linked to cities via `webcams.api_key_id`

```sql
SELECT * FROM webcams
WHERE api_key_id = (SELECT id FROM api_keys WHERE api_key = $1)
```

### 8.3 Caching Strategy

| Endpoint | Cache Key Pattern | TTL |
|----------|-------------------|-----|
| /cities | `cities:{search}` | 1 hour |
| /photos | `photos:{city_id}:{start}:{end}` | 1 hour |
| /videos | `videos:{city_id}:{start}:{end}` | 1 hour |
| /weather | `weather:{city_id}:{start}:{end}` | 1 hour |

Cache header `x-cache: HIT|MISS` added to all responses.

### 8.4 Idempotency

Video Lambda checks for existing videos before creation:
```sql
SELECT id FROM videos
WHERE city_id = $1
AND time_range_start <= $2
AND time_range_end >= $3
```

### 8.5 Error Handling

| HTTP Code | Meaning |
|-----------|---------|
| 200 | Success |
| 400 | Bad request (missing params) |
| 403 | Unauthorized (invalid API key) |
| 500 | Internal server error |

---

## 9. Architecture Decisions

| Decision | Alternatives Considered | Rationale |
|----------|------------------------|-----------|
| Lambda over EC2 | EC2, ECS | No server management, pay-per-use |
| PostgreSQL over DynamoDB | DynamoDB | Relational queries, familiar SQL |
| Upstash over ElastiCache | ElastiCache | Cheaper, serverless, easy setup |
| Sharp for images | ImageMagick | Better Lambda compatibility |
| FFmpeg for video | AWS MediaConvert | Cost, simplicity for timelapse |

---

## 10. Quality Requirements

### 10.1 Quality Tree

```
Quality
├── Performance
│   ├── Response time < 500ms (cached)
│   └── Video generation < 60s
├── Security
│   ├── API key authentication
│   └── No hardcoded secrets
├── Reliability
│   ├── Idempotent operations
│   └── Graceful error handling
└── Maintainability
    ├── Modular Lambda functions
    └── Clear documentation
```

### 10.2 Quality Scenarios

| Scenario | Measure | Target |
|----------|---------|--------|
| Cached API call | Response time | < 100ms |
| Uncached API call | Response time | < 500ms |
| Image processing | Processing time | < 5s |
| Video generation | Generation time | < 60s |

---

## 11. Risks and Technical Debt

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Redis unavailable | Low | High | Fallback to DB (not implemented) |
| S3 region mismatch | Medium | Medium | Use env var AWS_REGION |
| FFmpeg Layer missing | Low | High | Validate in Lambda code |
| Cold start latency | Medium | Low | Provisioned concurrency (not used) |

### Technical Debt

1. **URL-based image matching** - Picture Lambda matches by URL string, fragile if URL format changes
2. **No Redis fallback** - If Redis fails, API returns error
3. **Hardcoded 10-photo limit** - Video Lambda limits to 10 photos per city

---

## 12. Glossary

| Term | Definition |
|------|------------|
| Topic | A city/location for which weather data is collected |
| Webcam | An authenticated client that uploads photos and weather data |
| Timelapse | Video created from sequential photos |
| Cache Hit | Response served from Redis without DB query |
| Idempotency | Same operation produces same result when repeated |
| Lambda Layer | Shared code/binaries (e.g., FFmpeg) for Lambda functions |

---

## Appendix: File Structure

```
Serverless/
├── Frontend/
│   ├── index.html          # SPA entry point
│   ├── app.js              # Application logic
│   └── style.css           # Styling
├── last/last/
│   ├── courseproject-api/
│   │   └── index.js        # Public API Lambda
│   ├── courseproject-webcams/
│   │   └── index.js        # Webcam ingestion Lambda
│   ├── courseproject-picturelambda/
│   │   └── index.js        # Image processing Lambda
│   └── courseproject-videolambda/
│       └── index.js        # Video generation Lambda
├── docs/arc42/
│   └── arc42.md            # This document
├── .env.example            # Environment template
├── SECURITY.md             # Security guide
├── API_CONTRACT.md         # API documentation
├── TESTING_GUIDE.md        # Test instructions
├── DEMO_CHECKLIST.md       # 5-min demo script
└── COMPLIANCE_REPORT.md    # Acceptance criteria report
```
