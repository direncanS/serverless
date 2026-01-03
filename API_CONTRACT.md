# API CONTRACT - The Weather Archive

This document defines the API contracts for The Weather Archive project.

---

## Base URLs

| API | Base URL | Authentication |
|-----|----------|----------------|
| Public API | `https://g5gkedu6x6.execute-api.us-east-1.amazonaws.com` | None |
| Webcams API | `https://34gvv02dj9.execute-api.us-east-1.amazonaws.com` | x-api-key header |

---

## Public API Endpoints (GET Only)

### GET /cities

Search for cities by name or country.

**Request:**
```http
GET /cities?search={query}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| search | string | No | Search term (partial match) |

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "Vienna",
    "country": "Austria",
    "created_at": "2025-01-01T00:00:00.000Z"
  }
]
```

**Headers:**
- `x-cache: HIT|MISS` - Cache status

---

### GET /photos

Retrieve photos for a city within a date range.

**Request:**
```http
GET /photos?city_id={id}&start_date={date}&end_date={date}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| city_id | integer | Yes | City ID |
| start_date | ISO 8601 | No | Start of date range (default: 1970-01-01) |
| end_date | ISO 8601 | No | End of date range (default: now) |

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "city_id": 1,
    "webcam_id": 1,
    "image_url": "https://bucket.s3.region.amazonaws.com/processed/123.jpg",
    "timestamp": "2025-12-28T10:00:00.000Z",
    "metadata": "{}",
    "title": "Morning shot",
    "is_processed": true,
    "in_video": false,
    "created_at": "2025-12-28T10:00:00.000Z"
  }
]
```

---

### GET /videos

Retrieve videos for a city within a date range.

**Request:**
```http
GET /videos?city_id={id}&start_date={date}&end_date={date}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| city_id | integer | Yes | City ID |
| start_date | ISO 8601 | No | Start of date range |
| end_date | ISO 8601 | No | End of date range |

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "city_id": 1,
    "video_url": "https://bucket.s3.region.amazonaws.com/videos/video_1_uuid.mp4",
    "time_range_start": "2025-12-28T09:00:00.000Z",
    "time_range_end": "2025-12-28T10:00:00.000Z",
    "created_at": "2025-12-28T10:00:00.000Z"
  }
]
```

---

### GET /weather

Retrieve weather data for a city within a date range.

**Request:**
```http
GET /weather?city_id={id}&start_date={date}&end_date={date}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| city_id | integer | **Yes** | City ID (required) |
| start_date | ISO 8601 | No | Start of date range |
| end_date | ISO 8601 | No | End of date range |

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "city_id": 1,
    "temperature": 22.5,
    "humidity": 65,
    "pressure": 1013,
    "timestamp": "2025-12-28T10:00:00.000Z",
    "created_at": "2025-12-28T10:00:00.000Z"
  }
]
```

**Response (400 Bad Request):**
```json
{
  "message": "city_id parametresi zorunludur"
}
```

---

## Webcams API Endpoints (POST Only)

### Authentication

All requests require the `x-api-key` header:
```http
x-api-key: your-api-key-here
```

**Error Responses:**
- `401 Unauthorized`: Missing API key
- `403 Forbidden`: Invalid API key

---

### POST /photo

Upload a photo from a webcam.

**Request:**
```http
POST /photo
Content-Type: application/json
x-api-key: {api_key}

{
  "image": "data:image/jpeg;base64,/9j/4AAQ...",
  "title": "Morning shot",
  "metadata": "{\"description\": \"Clear sky\"}"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| image | string | Yes | Base64-encoded JPEG (with or without data URI prefix) |
| title | string | Yes | Photo title |
| metadata | string | No | JSON string with additional metadata |

**Response (200 OK):**
```json
{
  "id": 123,
  "city_id": 1,
  "webcam_id": 1,
  "image_url": "https://bucket.s3.region.amazonaws.com/photos/1735123456789-Morning-shot.jpg",
  "timestamp": "2025-12-28T10:00:00.000Z",
  "metadata": "{\"description\": \"Clear sky\"}",
  "title": "Morning shot"
}
```

**Side Effects:**
1. Image stored in S3 `photos/` prefix
2. Row inserted in `photos` table
3. S3 event triggers PictureService for processing

---

### POST /weather

Submit weather data from a webcam station.

**Request:**
```http
POST /weather
Content-Type: application/json
x-api-key: {api_key}

{
  "temperature": 22.5,
  "humidity": 65,
  "pressure": 1013
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| temperature | number | Yes | Temperature in Celsius |
| humidity | number | Yes | Humidity percentage (0-100) |
| pressure | number | Yes | Atmospheric pressure in hPa |

**Response (200 OK):**
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

## Error Response Format

All error responses follow this format:

```json
{
  "message": "Human-readable error message",
  "error": "Technical details (optional)"
}
```

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 204 | Success (OPTIONS preflight) |
| 400 | Bad request (missing/invalid params) |
| 401 | Missing authentication |
| 403 | Invalid authentication |
| 404 | Route not found |
| 500 | Internal server error |

---

## CORS Headers

### Public API
```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,OPTIONS
Access-Control-Expose-Headers: x-cache
```

### Webcams API
```http
Access-Control-Allow-Origin: https://weather-project-frontend-direncan.s3.us-east-1.amazonaws.com
Access-Control-Allow-Headers: Content-Type,x-api-key,X-Api-Key
Access-Control-Allow-Methods: OPTIONS,POST,GET
Access-Control-Max-Age: 86400
```

---

## Cache Behavior

| Endpoint | Cache Key Pattern | TTL |
|----------|-------------------|-----|
| /cities | `cities:{search}` | 1 hour |
| /photos | `photos:{city_id}:{start}:{end}` | 1 hour |
| /videos | `videos:{city_id}:{start}:{end}` | 1 hour |
| /weather | `weather:{city_id}:{start}:{end}` | 1 hour |

**Response Header:**
- `x-cache: HIT` - Served from Redis cache
- `x-cache: MISS` - Fetched from database
- `x-cache: UNKNOWN` - Cache status unavailable

---

## Database Schema Reference

### cities
```sql
CREATE TABLE cities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### api_keys
```sql
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  api_key VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### webcams
```sql
CREATE TABLE webcams (
  id SERIAL PRIMARY KEY,
  city_id INTEGER REFERENCES cities(id),
  api_key_id INTEGER REFERENCES api_keys(id),
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### photos
```sql
CREATE TABLE photos (
  id SERIAL PRIMARY KEY,
  city_id INTEGER REFERENCES cities(id),
  webcam_id INTEGER REFERENCES webcams(id),
  image_url TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata TEXT,
  title VARCHAR(255),
  is_processed BOOLEAN DEFAULT FALSE,
  is_failed BOOLEAN DEFAULT FALSE,
  in_video BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### videos
```sql
CREATE TABLE videos (
  id SERIAL PRIMARY KEY,
  city_id INTEGER REFERENCES cities(id),
  video_url TEXT NOT NULL,
  time_range_start TIMESTAMP,
  time_range_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### weather_data
```sql
CREATE TABLE weather_data (
  id SERIAL PRIMARY KEY,
  city_id INTEGER REFERENCES cities(id),
  temperature DECIMAL(5,2),
  humidity DECIMAL(5,2),
  pressure DECIMAL(7,2),
  timestamp TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Rate Limits

Currently no rate limiting is configured. Recommended limits:

| Endpoint | Recommended Limit |
|----------|-------------------|
| GET endpoints | 100 req/min per IP |
| POST /photo | 10 req/min per API key |
| POST /weather | 60 req/min per API key |

---

*API Version: 1.0*
*Last Updated: 2025-12-28*
