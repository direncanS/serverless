# DEMO CHECKLIST - The Weather Archive (5 Minutes)

This script guides you through a 5-minute demonstration of The Weather Archive project.

---

## Pre-Demo Setup (Before Recording)

- [ ] Browser open with frontend URL ready
- [ ] Postman/curl ready with API key
- [ ] AWS Console open (optional for showing logs)
- [ ] Database has sample data (cities, photos, weather, videos)

---

## Demo Script

### Part 1: Frontend Overview (1 min)

**Open Frontend:**
```
https://weather-project-frontend-direncan.s3.us-east-1.amazonaws.com/index.html
```

**Say:** "This is The Weather Archive - a serverless application for viewing weather data and timelapse videos from webcams around the world."

**Actions:**
1. [ ] Show the homepage with logo and search bar
2. [ ] Point out the Google-like minimal design

---

### Part 2: City Search & Autocomplete (1 min)

**Say:** "Users can search for cities using the autocomplete feature."

**Actions:**
1. [ ] Type "Vie" in search box
2. [ ] Show autocomplete dropdown appearing
3. [ ] Point out city + country format
4. [ ] Select "Vienna, Austria" from dropdown
5. [ ] Click Search button

**Say:** "The system only allows selection from valid cities in our database."

---

### Part 3: Topic View (1 min)

**Say:** "Once a city is selected, users see the topic view with video, weather chart, and date/time selectors."

**Actions:**
1. [ ] Show the timelapse video (or "No video" message)
2. [ ] Show the weather chart with temperature/humidity/pressure
3. [ ] Demonstrate date picker (only available dates shown)
4. [ ] Slide the hour slider to filter chart data
5. [ ] Click logo to return home

---

### Part 4: API & Caching Demo (1 min)

**Say:** "The backend uses Redis caching for performance."

**Actions (in browser DevTools or Postman):**

1. [ ] Open Network tab in DevTools
2. [ ] Navigate to a city
3. [ ] Show response header: `x-cache: MISS`
4. [ ] Refresh the page
5. [ ] Show response header: `x-cache: HIT`

**Say:** "First request hits the database (MISS), subsequent requests are served from cache (HIT)."

---

### Part 5: Webcam Upload Demo (1 min)

**Say:** "Webcams upload photos and weather data via authenticated API."

**Actions (Postman or curl):**

```bash
# Show successful weather upload
curl -X POST "https://34gvv02dj9.execute-api.us-east-1.amazonaws.com/weather" \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -d '{"temperature": 22.5, "humidity": 65, "pressure": 1013}'
```

1. [ ] Show 200 OK response with inserted data
2. [ ] Show 401 error without API key
3. [ ] Mention: "Photos are automatically resized by PictureService"
4. [ ] Mention: "VideoService runs hourly to create timelapse videos"

---

## Key Points to Mention

| Feature | Implementation |
|---------|----------------|
| Frontend | Static SPA on S3 |
| Public API | Lambda + API Gateway (GET) |
| Webcam API | Lambda + API Gateway (POST + API Key) |
| Caching | Upstash Redis (1 hour TTL) |
| Image Processing | Lambda triggered by S3 events |
| Video Generation | Lambda scheduled every 60 minutes |
| Database | PostgreSQL (RDS) |

---

## Architecture Diagram to Show (Optional)

```
┌─────────────┐     GET         ┌──────────────┐
│   Browser   │ ───────────────>│  Public API  │───> Redis ───> PostgreSQL
│  (Frontend) │                 │   (Lambda)   │
└─────────────┘                 └──────────────┘
       │
       │  Webcam                ┌──────────────┐
       │  Upload                │  Webcams API │───> S3 ───> PostgreSQL
       └───────────────────────>│   (Lambda)   │
                                └──────────────┘
                                       │
                        ┌──────────────┼──────────────┐
                        ▼              ▼              ▼
                 ┌──────────┐   ┌───────────┐  ┌─────────────┐
                 │ S3 Event │   │ EventBridge│  │ photos/     │
                 │ Trigger  │   │ Schedule   │  │ processed/  │
                 └────┬─────┘   └─────┬─────┘  │ videos/     │
                      ▼               ▼        └─────────────┘
               ┌──────────┐   ┌───────────┐
               │ Picture  │   │   Video   │
               │ Lambda   │   │  Lambda   │
               └──────────┘   └───────────┘
```

---

## Backup Demo Data SQL

If database is empty, run this seed data:

```sql
-- Insert a city
INSERT INTO cities (name, country) VALUES ('Vienna', 'Austria');

-- Insert an API key
INSERT INTO api_keys (api_key) VALUES ('demo-api-key-12345');

-- Link webcam to city and key
INSERT INTO webcams (city_id, api_key_id, name)
VALUES (1, 1, 'Vienna Cam 1');

-- Insert sample weather data
INSERT INTO weather_data (city_id, temperature, humidity, pressure, timestamp)
VALUES
  (1, 22.5, 65, 1013, NOW() - INTERVAL '1 hour'),
  (1, 23.0, 60, 1014, NOW());
```

---

## Demo End

**Say:** "That concludes the demo of The Weather Archive. The project demonstrates a fully serverless architecture using AWS Lambda, API Gateway, S3, PostgreSQL, and Redis for a complete weather data collection and visualization platform."

---

## Timing Summary

| Section | Duration |
|---------|----------|
| Frontend Overview | 1 min |
| Search & Autocomplete | 1 min |
| Topic View | 1 min |
| API & Caching | 1 min |
| Webcam Upload | 1 min |
| **Total** | **5 min** |
