# TESTING GUIDE - The Weather Archive

This guide provides step-by-step instructions for testing all API endpoints and frontend functionality.

---

## Prerequisites

- **curl** or **Postman** for API testing
- A valid **API Key** for webcams endpoints (from database `api_keys` table)
- Access to **AWS Console** for verifying S3 objects and Lambda logs

---

## API Endpoints

### Public API Base URL
```
https://g5gkedu6x6.execute-api.us-east-1.amazonaws.com
```

### Webcams API Base URL
```
https://34gvv02dj9.execute-api.us-east-1.amazonaws.com
```

---

## 1. Public API Tests (GET Endpoints)

### 1.1 GET /cities - Search Cities

**Purpose:** Autocomplete search for cities

```bash
# Search for cities containing "vie"
curl -X GET "https://g5gkedu6x6.execute-api.us-east-1.amazonaws.com/cities?search=vie" \
  -H "Accept: application/json"
```

**Expected Response:**
```json
[
  {"id": 1, "name": "Vienna", "country": "Austria"},
  {"id": 2, "name": "Montevideo", "country": "Uruguay"}
]
```

**Verify Cache:**
```bash
# Run twice - check x-cache header
curl -i "https://g5gkedu6x6.execute-api.us-east-1.amazonaws.com/cities?search=vie" 2>&1 | grep -i "x-cache"
# First: x-cache: MISS
# Second: x-cache: HIT
```

---

### 1.2 GET /photos - List Photos by City

**Purpose:** Retrieve photos for a specific city and date range

```bash
# Get photos for city_id=1
curl -X GET "https://g5gkedu6x6.execute-api.us-east-1.amazonaws.com/photos?city_id=1&start_date=2025-01-01&end_date=2025-12-31" \
  -H "Accept: application/json"
```

**Expected Response:**
```json
[
  {
    "id": 1,
    "city_id": 1,
    "image_url": "https://bucket.s3.region.amazonaws.com/processed/image.jpg",
    "timestamp": "2025-12-28T10:00:00.000Z",
    "is_processed": true,
    "in_video": false
  }
]
```

---

### 1.3 GET /videos - List Videos by City

**Purpose:** Retrieve timelapse videos for a city

```bash
curl -X GET "https://g5gkedu6x6.execute-api.us-east-1.amazonaws.com/videos?city_id=1&start_date=2025-01-01&end_date=2025-12-31" \
  -H "Accept: application/json"
```

**Expected Response:**
```json
[
  {
    "id": 1,
    "city_id": 1,
    "video_url": "https://bucket.s3.region.amazonaws.com/videos/video_1_uuid.mp4",
    "time_range_start": "2025-12-28T09:00:00.000Z",
    "time_range_end": "2025-12-28T10:00:00.000Z"
  }
]
```

---

### 1.4 GET /weather - Weather Data

**Purpose:** Retrieve weather measurements for a city

```bash
curl -X GET "https://g5gkedu6x6.execute-api.us-east-1.amazonaws.com/weather?city_id=1&start_date=2025-12-01&end_date=2025-12-31" \
  -H "Accept: application/json"
```

**Expected Response:**
```json
[
  {
    "id": 1,
    "city_id": 1,
    "temperature": 22.5,
    "humidity": 65,
    "pressure": 1013,
    "timestamp": "2025-12-28T10:00:00.000Z"
  }
]
```

**Error Case - Missing city_id:**
```bash
curl -X GET "https://g5gkedu6x6.execute-api.us-east-1.amazonaws.com/weather"
# Response: 400 {"message": "city_id parametresi zorunludur"}
```

---

## 2. Webcams API Tests (POST Endpoints)

### 2.1 POST /photo - Upload Photo

**Purpose:** Upload a webcam photo with metadata

```bash
# Replace YOUR_API_KEY with a valid key from api_keys table
curl -X POST "https://34gvv02dj9.execute-api.us-east-1.amazonaws.com/photo" \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...",
    "title": "test-photo",
    "metadata": "{\"description\": \"Test upload\"}"
  }'
```

**Expected Response:**
```json
{
  "id": 123,
  "city_id": 1,
  "webcam_id": 1,
  "image_url": "https://bucket.s3.region.amazonaws.com/photos/1735123456789-test-photo.jpg",
  "timestamp": "2025-12-28T10:00:00.000Z"
}
```

---

### 2.2 POST /weather - Upload Weather Data

**Purpose:** Submit weather measurements from a webcam station

```bash
curl -X POST "https://34gvv02dj9.execute-api.us-east-1.amazonaws.com/weather" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "temperature": 22.5,
    "humidity": 65,
    "pressure": 1013
  }'
```

**Expected Response:**
```json
{
  "id": 456,
  "city_id": 1,
  "temperature": 22.5,
  "humidity": 65,
  "pressure": 1013,
  "timestamp": "2025-12-28T10:00:00.000Z"
}
```

---

### 2.3 Authentication Error Cases

**Missing API Key:**
```bash
curl -X POST "https://34gvv02dj9.execute-api.us-east-1.amazonaws.com/photo" \
  -H "Content-Type: application/json" \
  -d '{"image": "...", "title": "test"}'
# Response: 401 {"message": "Missing API Key"}
```

**Invalid API Key:**
```bash
curl -X POST "https://34gvv02dj9.execute-api.us-east-1.amazonaws.com/photo" \
  -H "Content-Type: application/json" \
  -H "x-api-key: invalid-key-12345" \
  -d '{"image": "...", "title": "test"}'
# Response: 403 {"message": "Unauthorized API Key"}
```

---

### 2.4 CORS Preflight Test

```bash
curl -X OPTIONS "https://34gvv02dj9.execute-api.us-east-1.amazonaws.com/photo" \
  -H "Origin: https://weather-project-frontend-direncan.s3.us-east-1.amazonaws.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,x-api-key" \
  -i
```

**Expected Headers:**
```
HTTP/2 204
access-control-allow-origin: https://weather-project-frontend-direncan.s3.us-east-1.amazonaws.com
access-control-allow-headers: Content-Type,x-api-key,X-Api-Key
access-control-allow-methods: OPTIONS,POST,GET
access-control-max-age: 86400
```

---

## 3. Frontend Browser Tests

### 3.1 Homepage Test

1. Open: `https://weather-project-frontend-direncan.s3.us-east-1.amazonaws.com/index.html`
2. **Verify:**
   - Logo (cloud icon) is visible
   - Search input field is present
   - Search button is present

### 3.2 Autocomplete Test

1. Type "vie" in search box
2. **Verify:**
   - Dropdown appears with city suggestions
   - Each suggestion shows city name and country

### 3.3 Search Validation Test

1. Type "xyz123" (non-existent city) and press Enter
2. **Verify:**
   - Error message appears: "Please select a city from the dropdown list"

### 3.4 Navigation Test

1. Type "Vienna", select from dropdown
2. Click Search button
3. **Verify:**
   - URL changes to `#topic/Vienna/1`
   - Topic view shows city name heading
   - Video player is visible (or "No video" message)
   - Weather chart is displayed
   - Date picker has selectable dates

### 3.5 Logo Home Navigation

1. From topic view, click the logo
2. **Verify:**
   - Returns to homepage
   - Search input is cleared

### 3.6 Cache Status Check

1. Open browser DevTools > Network tab
2. Navigate to a city topic
3. **Verify:**
   - Response headers include `x-cache: MISS` (first load)
   - Refresh page - `x-cache: HIT` (cached)

---

## 4. S3 Object Verification

### Check Photos Bucket
```bash
aws s3 ls s3://weather-archive-project-direncan-sahin/photos/ --region us-east-1
```

### Check Processed Images
```bash
aws s3 ls s3://weather-archive-project-direncan-sahin/processed/ --region us-east-1
```

### Check Videos
```bash
aws s3 ls s3://weather-archive-project-direncan-sahin/videos/ --region us-east-1
```

---

## 5. Database Verification

### Check Cities Table
```sql
SELECT * FROM cities LIMIT 10;
```

### Check API Keys
```sql
SELECT api_key, created_at FROM api_keys LIMIT 5;
```

### Check Photos with Processing Status
```sql
SELECT id, city_id, image_url, is_processed, in_video, created_at
FROM photos
ORDER BY created_at DESC
LIMIT 10;
```

### Check Videos
```sql
SELECT id, city_id, video_url, time_range_start, time_range_end
FROM videos
ORDER BY created_at DESC
LIMIT 5;
```

---

## 6. CloudWatch Logs Verification

### View Lambda Logs
```bash
# API Lambda
aws logs tail /aws/lambda/courseproject-api --follow --region us-east-1

# Webcams Lambda
aws logs tail /aws/lambda/courseproject-webcams --follow --region us-east-1

# Picture Lambda
aws logs tail /aws/lambda/courseproject-picturelambda --follow --region us-east-1

# Video Lambda
aws logs tail /aws/lambda/courseproject-videolambda --follow --region us-east-1
```

### Check for Cache HIT/MISS in Logs
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/courseproject-api \
  --filter-pattern "CACHE" \
  --region us-east-1
```

---

## 7. Postman Collection

Import the included Postman collections for easier testing:
- `Api.postman_collection (1).json` - Public API endpoints
- `WebCams.postman_collection.json` - Webcams API endpoints

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS error in browser | Check OPTIONS response headers, verify ALLOWED_ORIGIN env var |
| 401 Missing API Key | Add `x-api-key` header to request |
| 403 Unauthorized | Verify API key exists in `api_keys` table and is linked to a webcam |
| x-cache: UNKNOWN | Check REDIS_URL env var, verify Upstash connection |
| No videos appearing | Check VideoService schedule, verify photos have `is_processed=true` |
| Photos not processed | Check PictureService S3 trigger, verify Lambda has permissions |
