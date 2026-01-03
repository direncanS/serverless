// ============================================================================
// THE WEATHER ARCHIVE - Configuration
// ============================================================================
// Change these URLs to match your deployed API Gateway endpoints

const CONFIG = {
    // Public API (api-lambda) - READ endpoints: cities, photos, videos, weather
    PUBLIC_API_BASE_URL: "https://g5gkedu6x6.execute-api.us-east-1.amazonaws.com",

    // Webcams API (webcams-lambda) - WRITE endpoints: POST /photo, POST /weather
    WEBCAMS_API_BASE_URL: "https://34gvv02dj9.execute-api.us-east-1.amazonaws.com",

    // Default date range for queries (days)
    DEFAULT_DATE_RANGE_DAYS: 7
};

// Freeze config to prevent accidental modification
Object.freeze(CONFIG);
