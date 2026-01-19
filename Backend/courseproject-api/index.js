const { Pool } = require("pg");
const Redis = require("ioredis");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const redis = new Redis(process.env.REDIS_URL);

// CORS Headers - Required for browser requests
const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Expose-Headers": "x-cache", // Frontend'in x-cache header'ını okuması için
  "Access-Control-Max-Age": "86400"
};

// Redis fallback helpers - Redis hatasında DB'ye düşer
const safeRedisGet = async (key) => {
  try {
    return await redis.get(key);
  } catch (err) {
    console.warn('Redis GET error, falling back to DB:', err.message);
    return null;
  }
};

const safeRedisSet = async (key, value, ttl = 3600) => {
  try {
    await redis.set(key, value, 'EX', ttl);
  } catch (err) {
    console.warn('Redis SET error, continuing without cache:', err.message);
  }
};

exports.handler = async (event) => {
  try {
    console.log(event)
    const path = event.rawPath || event.path;
    const method = event.requestContext?.http?.method || event.httpMethod;
    const queryParams = event.queryStringParameters || {};

    // 0. PREFLIGHT (OPTIONS) REQUEST - CORS için gerekli
    if (method === "OPTIONS") {
      return { statusCode: 204, headers: corsHeaders, body: "" };
    }

    // 📍 Şehirleri listeleme (GET /cities)
    if (path.endsWith("/cities") && method === "GET") {
      const searchQuery = queryParams.search || '';
      const cacheKey = `cities:${searchQuery}`;
      
      // Redis'ten kontrol (fallback destekli)
      const cachedData = await safeRedisGet(cacheKey);
      if (cachedData) {
        console.log('CACHE HIT:', cacheKey);
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'x-cache': 'HIT'
          },
          body: cachedData
        };
      }

      console.log('CACHE MISS:', cacheKey);
      const result = await pool.query(
        "SELECT * FROM cities WHERE name ILIKE $1 OR country ILIKE $1",
        [`%${searchQuery}%`]
      );

      // Redis'e kaydet (1 saat TTL, fallback destekli)
      await safeRedisSet(cacheKey, JSON.stringify(result.rows));
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'x-cache': 'MISS'
        },
        body: JSON.stringify(result.rows)
      }
    }

    // 📍 Fotoğrafları listeleme (GET /photos)
    if (path.endsWith("/photos") && method === "GET") {
      const { city_id, start_date, end_date } = queryParams;

      if (!city_id) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: "city_id parameter is required" })
        };
      }

      const cacheKey = `photos:${city_id}:${start_date}:${end_date}`;

      const cachedData = await safeRedisGet(cacheKey);
      if (cachedData) {
        console.log('CACHE HIT:', cacheKey);
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'x-cache': 'HIT'
          },
          body: cachedData
        };
      }

      console.log('CACHE MISS:', cacheKey);
      const result = await pool.query(
        "SELECT * FROM photos WHERE city_id = $1 AND timestamp BETWEEN $2 AND $3",
        [city_id, start_date || '1970-01-01', end_date || new Date().toISOString()]
      );

      await safeRedisSet(cacheKey, JSON.stringify(result.rows));
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'x-cache': 'MISS'
        },
        body: JSON.stringify(result.rows)
      }
    }

    // 📍 Videoları listeleme (GET /videos)
    if (path.endsWith("/videos") && method === "GET") {
      const { city_id, start_date, end_date } = queryParams;

      if (!city_id) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: "city_id parameter is required" })
        };
      }

      const cacheKey = `videos:${city_id}:${start_date}:${end_date}`;

      const cachedData = await safeRedisGet(cacheKey);
      if (cachedData){
        console.log('CACHE HIT:', cacheKey);
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'x-cache': 'HIT'
          },
          body: cachedData
        }
      }

      console.log('CACHE MISS:', cacheKey);
      const result = await pool.query(
        "SELECT * FROM videos WHERE city_id = $1 AND time_range_start >= $2 AND time_range_end <= $3 ORDER BY created_at DESC",
        [city_id, start_date || '1970-01-01', end_date || new Date().toISOString()]
      );

      await safeRedisSet(cacheKey, JSON.stringify(result.rows));
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'x-cache': 'MISS'
        },
        body: JSON.stringify(result.rows)
      }
    }

    // 📍 Hava durumu verilerini listeleme (GET /weather)
    if (path.endsWith("/weather") && method === "GET") {
      const { city_id, start_date, end_date } = queryParams;
      
      if (!city_id) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: "city_id parametresi zorunludur" })
        };
      }

      const cacheKey = `weather:${city_id}:${start_date}:${end_date}`;

      const cachedData = await safeRedisGet(cacheKey);
      if (cachedData) {
        console.log('CACHE HIT:', cacheKey);
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'x-cache': 'HIT'
          },
          body: cachedData
        };
      }

      console.log('CACHE MISS:', cacheKey);
      try {
        const result = await pool.query(
          "SELECT * FROM weather_data WHERE city_id = $1 AND timestamp BETWEEN $2 AND $3",
          [city_id, start_date || '1970-01-01', end_date || new Date().toISOString()]
        );

        await safeRedisSet(cacheKey, JSON.stringify(result.rows));
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'x-cache': 'MISS'
          },
          body: JSON.stringify(result.rows)
        };
      } catch (dbError) {
        console.error("Veritabanı hatası:", dbError);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            message: "Veritabanı işlemi sırasında bir hata oluştu",
            error: dbError.message 
          })
        };
      }
    }

    // 404 - Route bulunamadı
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: "Route not found" })
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: "Internal Server Error", error: error.message })
    };
  }
};
