# COMPLIANCE REPORT - The Weather Archive

**Audit Date:** 2025-12-28
**Auditor:** Cloud Software Architect
**Status:** IN PROGRESS

---

## Executive Summary

| Category | Pass | Partial | Fail | Verify |
|----------|------|---------|------|--------|
| Frontend & UI (1-10) | 10 | 0 | 0 | 0 |
| Webcam API (11-13) | 3 | 0 | 0 | 0 |
| Backend & API (14-22) | 9 | 0 | 0 | 0 |
| Background Services (23-30) | 7 | 0 | 0 | 1 |
| **TOTAL** | **29** | **0** | **0** | **1** |

---

## Frontend & UI (Items 1-10)

### Item 1: Homepage with Logo + Search Bar
| Status | Evidence |
|--------|----------|
| ✅ PASS | `Frontend/index.html:15-35` |

**Evidence:**
```html
<!-- index.html:15-35 -->
<div class="logo" onclick="navigateHome()">
    <span class="logo-icon">&#9729;</span>
    <h1>The Weather Archive</h1>
</div>
...
<input type="text" id="search-input" placeholder="Search for a city...">
<button id="search-btn" onclick="handleSearch()">Search</button>
```

---

### Item 2: Autocomplete List from GET /cities
| Status | Evidence |
|--------|----------|
| ✅ PASS | `Frontend/app.js:168-193, 596-601` |

**Evidence:**
```javascript
// app.js:180-188
const cities = await fetchCities(query);
if (cities.length === 0) {
    hideAutocomplete();
    return;
}
renderAutocomplete(cities);

// app.js:596-601
async function fetchCities(search) {
    const { data, cacheStatus } = await publicApi.get('/cities', { search });
    return data;
}
```

**Test Request:**
```bash
curl -X GET "https://g5gkedu6x6.execute-api.us-east-1.amazonaws.com/cities?search=vie"
```

---

### Item 3: Only Allow Selection from Autocomplete
| Status | Evidence |
|--------|----------|
| ✅ PASS | `Frontend/app.js:264-287` |

**Evidence:**
```javascript
// app.js:272-276
if (!selectedCity) {
    showError("Please select a city from the dropdown list. Type to search, then click a suggestion.");
    return;
}
```

---

### Item 4: Error if Topic Not in List
| Status | Evidence |
|--------|----------|
| ✅ PASS | `Frontend/app.js:267-283` |

**Evidence:**
```javascript
// app.js:267-270
if (!inputValue) {
    showError("Please enter a city name to search.");
    return;
}

// app.js:277-283 - Validates match
const expectedValue = selectedCity.name + (selectedCity.country ? `, ${selectedCity.country}` : "");
if (inputValue !== expectedValue && inputValue !== selectedCity.name) {
    showError("Please select a city from the dropdown list. The entered text doesn't match your selection.");
    return;
}
```

---

### Item 5: Navigate to New Page on Valid Selection
| Status | Evidence |
|--------|----------|
| ✅ PASS | `Frontend/app.js:135-138, 286` |

**Evidence:**
```javascript
// app.js:135-138
function navigateToTopic(city) {
    const encodedName = encodeURIComponent(city.name);
    window.location.hash = `topic/${encodedName}/${city.id}`;
}

// app.js:286
navigateToTopic(selectedCity);
```

---

### Item 6: Topic Page Components (Title, Video, Plot, Date Picker, Hour Slider)
| Status | Evidence |
|--------|----------|
| ✅ PASS | `Frontend/index.html:38-86` |

**Evidence:**
```html
<!-- index.html:48-84 -->
<h1 id="topic-title">City Name</h1>
<video id="topic-video" controls>...</video>
<select id="date-picker">...</select>
<input type="range" id="hour-slider" min="0" max="23">
<canvas id="weather-chart"></canvas>
```

---

### Item 7: Only Available Dates Selectable
| Status | Evidence |
|--------|----------|
| ✅ PASS | `Frontend/app.js:365-384` |

**Evidence:**
```javascript
// app.js:365-384
function populateDatePicker() {
    datePicker.innerHTML = availableDates.map(date => {
        const formatted = new Date(date).toLocaleDateString("en-US", {...});
        return `<option value="${date}">${formatted}</option>`;
    }).join("");
}
```

---

### Item 8: Only Available Hours Selectable for Date
| Status | Evidence |
|--------|----------|
| ✅ PASS | `Frontend/app.js:394-415` |

**Evidence:**
```javascript
// app.js:394-415
function updateHourSlider(date) {
    const hours = availableHoursByDate[date] || [];
    hourSlider.min = Math.min(...hours);
    hourSlider.max = Math.max(...hours);
    hoursInfo.textContent = `Available hours: ${hours.join(", ")}`;
}
```

---

### Item 9: Logo Clickable to Return Home
| Status | Evidence |
|--------|----------|
| ✅ PASS | `Frontend/index.html:15,41` + `app.js:130-133` |

**Evidence:**
```html
<!-- index.html:15 -->
<div class="logo" onclick="navigateHome()">

<!-- index.html:41 -->
<div class="logo logo-small" onclick="navigateHome()">
```
```javascript
// app.js:130-133
function navigateHome() {
    window.location.hash = "";
    showHomeView();
}
```

---

### Item 10: Human-Readable Error Messages
| Status | Evidence |
|--------|----------|
| ✅ PASS | `Frontend/app.js:289-295` + `index.html:34` |

**Evidence:**
```javascript
// app.js:289-291
function showError(message) {
    searchError.textContent = message;
}
```
```html
<!-- index.html:34 -->
<div id="search-error" class="error-message"></div>
```

---

## Webcam & Input Simulation (Items 11-13)

### Item 11: Webcam POST with Image + Topic + Metadata
| Status | Evidence |
|--------|----------|
| ✅ PASS | `Frontend/app.js:656-662` + `webcams-lambda:80-111` |

**Evidence:**
```javascript
// app.js:656-662
async function uploadPhoto(apiKey, imageBase64, title, metadata = {}) {
    return await webcamsApi.post('/photo', {
        image: imageBase64,
        title: title,
        metadata: JSON.stringify(metadata)
    }, apiKey);
}

// webcams-lambda/index.js:80-111
if ((path.endsWith("/photo") || path === "/photo") && method === "POST") {
    const { image, title, metadata } = body;
    // ... S3 upload + DB insert
}
```

**Test Request:**
```bash
curl -X POST "https://34gvv02dj9.execute-api.us-east-1.amazonaws.com/photo" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"image":"base64...", "title":"test", "metadata":"{}"}'
```

---

### Item 12: API Key Authentication (x-api-key)
| Status | Evidence |
|--------|----------|
| ✅ PASS | `webcams-lambda:42-63` |

**Evidence:**
```javascript
// webcams-lambda/index.js:42-51
const apiKey = event.headers["x-api-key"] || event.headers["X-Api-Key"];

if (!apiKey) {
    return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Missing API Key" })
    };
}

// webcams-lambda/index.js:53-63
const keyCheck = await client.query(
    "SELECT * FROM webcams WHERE api_key_id = (SELECT id FROM api_keys WHERE api_key = $1)",
    [apiKey]
);

if (keyCheck.rowCount === 0) {
    return {
        statusCode: 403,
        body: JSON.stringify({ message: "Unauthorized API Key" })
    };
}
```

---

### Item 13: Proper HTTP Error Codes
| Status | Evidence |
|--------|----------|
| ✅ PASS | `webcams-lambda` various lines |

**Evidence:**
| Code | Location | Usage |
|------|----------|-------|
| 200 | :77, :110, :116, :122 | Success responses |
| 401 | :47 | Missing API Key |
| 403 | :59 | Invalid API Key |
| 400 | :125 | Invalid route |
| 500 | :129 | Internal error |

---

## Backend & API Logic (Items 14-22)

### Item 14: API Stores Image in S3 (photos/)
| Status | Evidence |
|--------|----------|
| ✅ PASS | `webcams-lambda:91-101` |

**Evidence:**
```javascript
// webcams-lambda/index.js:91-101
const bucketName = process.env.S3_BUCKET_NAME || process.env.BUCKET_NAME;
const fileName = `photos/${Date.now()}-${title}.jpg`;

const uploadParams = {
    Bucket: bucketName,
    Key: fileName,
    Body: imageBuffer,
    ContentType: "image/jpeg",
};

await s3Client.send(new PutObjectCommand(uploadParams));
```

---

### Item 15: API Stores Data in Database
| Status | Evidence |
|--------|----------|
| ✅ PASS | `webcams-lambda:106-109` |

**Evidence:**
```javascript
// webcams-lambda/index.js:106-109
const result = await pool.query(
    "INSERT INTO photos (city_id, webcam_id, image_url, timestamp, metadata, title) VALUES ($1, $2, $3, NOW(), $4, $5) RETURNING *",
    [webCam.city_id, webCam.id, location, metadata, title]
);
```

---

### Item 16: API Retrieves Data from Database
| Status | Evidence |
|--------|----------|
| ✅ PASS | `api-lambda:74-77, 112-114, 149-151, 199-201` |

**Evidence:**
```javascript
// api-lambda/index.js - Multiple SELECT queries
// :74-77 (cities)
const result = await pool.query(
    "SELECT * FROM cities WHERE name ILIKE $1 OR country ILIKE $1",
    [`%${searchQuery}%`]
);

// :112-114 (photos)
"SELECT * FROM photos WHERE city_id = $1 AND timestamp BETWEEN $2 AND $3"

// :149-151 (videos)
"SELECT * FROM videos WHERE city_id = $1 AND time_range_start >= $2 AND time_range_end <= $3"

// :199-201 (weather)
"SELECT * FROM weather_data WHERE city_id = $1 AND timestamp BETWEEN $2 AND $3"
```

---

### Item 17: PictureService Retrieves from S3
| Status | Evidence |
|--------|----------|
| ✅ PASS | `picture-lambda:42-50` |

**Evidence:**
```javascript
// picture-lambda/index.js:42-50
const getCommand = new GetObjectCommand({
    Bucket: sourceBucket,
    Key: sourceKey
});
const response = await s3Client.send(getCommand);
const imageData = await streamToBuffer(response.Body);
```

---

### Item 18: API Writes to Redis Cache
| Status | Evidence |
|--------|----------|
| ✅ PASS | `api-lambda:33-38, 80, 117, 154, 204` |

**Evidence:**
```javascript
// api-lambda/index.js:33-38
const safeRedisSet = async (key, value, ttl = 3600) => {
    try {
        await redis.set(key, value, 'EX', ttl);
    } catch (err) {
        console.warn('Redis SET error, continuing without cache:', err.message);
    }
};

// Called after each DB query:
// :80 - await safeRedisSet(cacheKey, JSON.stringify(result.rows));
// :117 - await safeRedisSet(cacheKey, JSON.stringify(result.rows));
// :154 - await safeRedisSet(cacheKey, JSON.stringify(result.rows));
// :204 - await safeRedisSet(cacheKey, JSON.stringify(result.rows));
```

---

### Item 19: Cache Key Includes Topic + Time Range
| Status | Evidence |
|--------|----------|
| ✅ PASS | `api-lambda:56, 95, 132, 181` |

**Evidence:**
```javascript
// api-lambda/index.js - Cache key patterns:
// :56 - cities
const cacheKey = `cities:${searchQuery}`;

// :95 - photos
const cacheKey = `photos:${city_id}:${start_date}:${end_date}`;

// :132 - videos
const cacheKey = `videos:${city_id}:${start_date}:${end_date}`;

// :181 - weather
const cacheKey = `weather:${city_id}:${start_date}:${end_date}`;
```

---

### Item 20: API Checks Cache BEFORE Database (CRITICAL)
| Status | Evidence |
|--------|----------|
| ✅ PASS | `api-lambda:59-71, 97-109, 134-146, 183-195` |

**Evidence:**
```javascript
// api-lambda/index.js:59-71 (pattern repeated for all endpoints)
const cachedData = await safeRedisGet(cacheKey);  // 1. Check cache FIRST
if (cachedData) {
    console.log('CACHE HIT:', cacheKey);
    return {
        statusCode: 200,
        headers: { 'x-cache': 'HIT' },
        body: cachedData  // 2. Return cached data (no DB query)
    };
}

console.log('CACHE MISS:', cacheKey);
const result = await pool.query(...);  // 3. Only query DB on MISS
```

---

### Item 21: API Returns Cached Results on HIT
| Status | Evidence |
|--------|----------|
| ✅ PASS | `api-lambda:60-70` |

**Evidence:**
```javascript
// api-lambda/index.js:60-70
if (cachedData) {
    console.log('CACHE HIT:', cacheKey);
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'x-cache': 'HIT'  // <-- Header indicates cache hit
        },
        body: cachedData  // <-- Returns cached JSON directly
    };
}
```

**Test Verification:**
```bash
# First request (MISS)
curl -i "https://g5gkedu6x6.execute-api.us-east-1.amazonaws.com/cities?search=vienna"
# Response header: x-cache: MISS

# Second request (HIT)
curl -i "https://g5gkedu6x6.execute-api.us-east-1.amazonaws.com/cities?search=vienna"
# Response header: x-cache: HIT
```

---

### Item 22: Cache Works on Multiple Endpoints
| Status | Evidence |
|--------|----------|
| ✅ PASS | All 4 GET endpoints implement same pattern |

**Evidence:**
| Endpoint | Cache Check Line | Cache Set Line |
|----------|------------------|----------------|
| /cities | :59 | :80 |
| /photos | :97 | :117 |
| /videos | :134 | :154 |
| /weather | :183 | :204 |

---

## Background Services (Items 23-30)

### Item 23: PictureService Retrieves from S3
| Status | Evidence |
|--------|----------|
| ✅ PASS | `picture-lambda:42-50` |

**Evidence:** (Same as Item 17)
```javascript
const getCommand = new GetObjectCommand({
    Bucket: sourceBucket,
    Key: sourceKey
});
const response = await s3Client.send(getCommand);
```

---

### Item 24: PictureService Stores Processed Image in S3 (processed/)
| Status | Evidence |
|--------|----------|
| ✅ PASS | `picture-lambda:68-78` |

**Evidence:**
```javascript
// picture-lambda/index.js:68-78
const destKey = `processed/${fileName}.jpg`;

const putCommand = new PutObjectCommand({
    Bucket: sourceBucket,
    Key: destKey,
    Body: resizedImageBuffer,
    ContentType: 'image/jpeg'
});

await s3Client.send(putCommand);
```

---

### Item 25: PictureService Resizes/Compresses Image
| Status | Evidence |
|--------|----------|
| ✅ PASS | `picture-lambda:56-65` |

**Evidence:**
```javascript
// picture-lambda/index.js:56-65
const resizedImageBuffer = await sharp(imageData)
    .rotate()  // EXIF correction
    .resize({
        width: 800,
        height: 600,
        fit: sharp.fit.inside,
        withoutEnlargement: true
    })
    .toFormat('jpeg', { quality: 80 })  // Compression
    .toBuffer();
```

---

### Item 26: VideoService Scheduled (EventBridge rate(60 minutes))
| Status | Evidence |
|--------|----------|
| ❓ VERIFY | No serverless.yml/SAM template found in repo |

**Expected Configuration (AWS Console or IaC):**
```yaml
# Expected EventBridge Rule
Type: AWS::Events::Rule
Properties:
  ScheduleExpression: "rate(60 minutes)"
  Targets:
    - Arn: !GetAtt VideoLambdaFunction.Arn
```

**Verification Steps:**
1. AWS Console > EventBridge > Rules
2. Look for rule targeting video-lambda
3. Verify schedule expression is `rate(60 minutes)` or `rate(1 hour)`

---

### Item 27: VideoService Reads from Database
| Status | Evidence |
|--------|----------|
| ✅ PASS | `video-lambda:65-76` |

**Evidence:**
```javascript
// video-lambda/index.js:65-76
const query = `
    SELECT id, image_url, city_id, created_at
    FROM photos
    WHERE image_url LIKE '%/processed/%'
      AND is_processed = true
      AND is_failed = false
      AND in_video = false
      AND created_at >= $1
      AND created_at < $2
    ORDER BY city_id, created_at DESC
`;
const { rows: allPhotos } = await client.query(query, [windowStart, windowEnd]);
```

---

### Item 28: VideoService Creates Video from Images
| Status | Evidence |
|--------|----------|
| ✅ PASS | `video-lambda:184-199` |

**Evidence:**
```javascript
// video-lambda/index.js:184-199
await new Promise((resolve, reject) => {
    ffmpeg()
        .input(listFilePath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
            '-c:v', 'libx264',
            '-r', '30',
            '-pix_fmt', 'yuv420p',
            '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2'
        ])
        .save(videoPath)
        .on('end', resolve)
        .on('error', reject);
});
```

---

### Item 29: VideoService Avoids Duplicate Processing (Idempotency)
| Status | Evidence |
|--------|----------|
| ✅ PASS | `video-lambda:71, 154-169, 222` |

**Evidence:**
```javascript
// video-lambda/index.js:71 - Select only unprocessed photos
WHERE in_video = false

// video-lambda/index.js:154-169 - Check for existing video
const existingVideoCheck = await client.query(
    `SELECT id FROM videos
     WHERE city_id = $1
     AND time_range_start <= $2
     AND time_range_end >= $3
     LIMIT 1`,
    [cityId, latestTimestamp, earliestTimestamp]
);

if (existingVideoCheck.rowCount > 0) {
    console.log(`IDEMPOTENCY: Video already exists...`);
    await client.query(`UPDATE photos SET in_video = true WHERE id = ANY($1)`, [successfulPhotos]);
    continue;
}

// video-lambda/index.js:222 - Mark photos as used
await client.query(`UPDATE photos SET in_video = true WHERE id = ANY($1)`, [successfulPhotos]);
```

---

### Item 30: VideoService Stores Video in S3 (videos/)
| Status | Evidence |
|--------|----------|
| ✅ PASS | `video-lambda:201-210` |

**Evidence:**
```javascript
// video-lambda/index.js:201-210
const videoS3Key = `videos/${videoFileName}`;
const videoBuffer = fs.readFileSync(videoPath);

await s3Client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: videoS3Key,
    Body: videoBuffer,
    ContentType: "video/mp4"
}));
```

---

## CORS Configuration Status

### Webcams Lambda (POST endpoints)
| Status | Evidence |
|--------|----------|
| ✅ PASS | `webcams-lambda:15-20, 32-34` |

```javascript
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type,x-api-key,X-Api-Key",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
  "Access-Control-Max-Age": "86400"
};

// OPTIONS handler
if (method === "OPTIONS") {
  return { statusCode: 204, headers: corsHeaders, body: "" };
}
```

### API Lambda (GET endpoints)
| Status | Evidence |
|--------|----------|
| ✅ PASS | `api-lambda:13-21, 48-51` |

```javascript
const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Expose-Headers": "x-cache",
  "Access-Control-Max-Age": "86400"
};

// OPTIONS handler
if (method === "OPTIONS") {
  return { statusCode: 204, headers: corsHeaders, body: "" };
}
```

---

## Summary

| Total Items | Status |
|-------------|--------|
| 29/30 | ✅ PASS |
| 0/30 | ⚠️ PARTIAL |
| 0/30 | ❌ FAIL |
| 1/30 | ❓ VERIFY (Item 26: VideoService scheduling) |

### Action Required
- **Item 26:** Verify EventBridge rule exists in AWS Console with `rate(60 minutes)` schedule targeting video-lambda function.

---

*Report generated: 2025-12-28*
