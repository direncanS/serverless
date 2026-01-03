const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const s3Client = new S3Client();

// CORS Headers - Required for browser requests from S3-hosted frontend
// For production: use specific origin. For development/testing: can use '*'
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://weather-project-frontend-direncan.s3.us-east-1.amazonaws.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type,x-api-key,X-Api-Key",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
  "Access-Control-Max-Age": "86400" // Cache preflight for 24 hours
};

exports.handler = async (event) => {
  try {
    console.log("Event:", JSON.stringify(event, null, 2));

    // HTTP Metodu ve Yolu
    const path = event.rawPath || event.path;
    const method = event.requestContext?.http?.method || event.httpMethod;

    // 0. PREFLIGHT (OPTIONS) REQUEST
    // Browsers send OPTIONS before POST to check if CORS is allowed
    if (method === "OPTIONS") {
      return { statusCode: 204, headers: corsHeaders, body: "" };
    }

    // Body parsing
    let body = {};
    if (event.body) {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    }

    const apiKey = event.headers["x-api-key"] || event.headers["X-Api-Key"];

    // 1. GÜVENLİK KONTROLÜ (API KEY)
    if (!apiKey) {
      return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Missing API Key" })
      };
    }

    const client = await pool.connect();
    const keyCheck = await client.query("SELECT * FROM webcams WHERE api_key_id = (SELECT id FROM api_keys WHERE api_key = $1)", [apiKey]);

    if (keyCheck.rowCount === 0) {
      client.release();
      return { 
          statusCode: 403, 
          headers: corsHeaders, 
          body: JSON.stringify({ message: "Unauthorized API Key" }) 
      };
    }

    const webCam = keyCheck.rows[0];
    client.release();

    // --- YÖNLENDİRME MANTIĞI ---

    // 2. HAVA DURUMU KAYDETME (POST /weather)
    if ((path.endsWith("/weather") || path === "/weather") && method === "POST") {
      const { temperature, humidity, pressure } = body;
      const result = await pool.query(
        "INSERT INTO weather_data (city_id, temperature, humidity, pressure, timestamp) VALUES ($1, $2, $3, $4, NOW()) RETURNING *",
        [webCam.city_id, temperature, humidity, pressure]
      );
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result.rows[0]) };
    }

    // 3. FOTOĞRAF YÜKLEME (POST /photo)
    if ((path.endsWith("/photo") || path === "/photo") && method === "POST") {
      const { image, title, metadata } = body;

      let cleanImage = image;
      if (cleanImage.includes(",")) {
        cleanImage = cleanImage.split(",")[1];
      }
      cleanImage = cleanImage.replace(/\s/g, "");
      
      const imageBuffer = Buffer.from(cleanImage, "base64");
      const bucketName = process.env.S3_BUCKET_NAME || process.env.BUCKET_NAME;
      const fileName = `photos/${Date.now()}-${title}.jpg`;

      const uploadParams = {
        Bucket: bucketName,
        Key: fileName,
        Body: imageBuffer,
        ContentType: "image/jpeg",
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      const region = process.env.AWS_REGION || "eu-central-1";
      const location = `https://${bucketName}.s3.${region}.amazonaws.com/${fileName}`;

      const result = await pool.query(
        "INSERT INTO photos (city_id, webcam_id, image_url, timestamp, metadata, title) VALUES ($1, $2, $3, NOW(), $4, $5) RETURNING *",
        [webCam.city_id, webCam.id, location, metadata, title]
      );
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result.rows[0]) };
    }

    // 4. FOTOĞRAFLARI LİSTELEME (GET /photos)
    if ((path.endsWith("/photos") || path === "/photos") && method === "GET") {
      const result = await pool.query("SELECT * FROM photos ORDER BY created_at DESC LIMIT 50");
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result.rows) };
    }

    // 5. VİDEOLARI LİSTELEME (GET /videos)
    if ((path.endsWith("/videos") || path === "/videos") && method === "GET") {
      const result = await pool.query("SELECT * FROM videos ORDER BY created_at DESC LIMIT 10");
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result.rows) };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: "Invalid API route" }) };

  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: "Internal Server Error", error: error.message }) };
  }
};