// ============================================================================
// THE WEATHER ARCHIVE - Frontend Application
// ============================================================================
// Note: Requires config.js to be loaded before this file

// =========================== API CLIENTS =====================================
// Centralized API clients using CONFIG from config.js

const publicApi = {
    baseUrl: CONFIG.PUBLIC_API_BASE_URL,

    async get(endpoint, params = {}) {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.append(key, value);
            }
        });

        const response = await fetch(url.toString());
        const cacheStatus = response.headers.get('x-cache') || 'UNKNOWN';

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return { data, cacheStatus };
    }
};

const webcamsApi = {
    baseUrl: CONFIG.WEBCAMS_API_BASE_URL,

    async post(endpoint, body, apiKey) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }
};

// =========================== STATE ==========================================
let selectedCity = null;          // { id, name, country } - the city user picked from dropdown
let weatherData = [];             // Raw weather data from API
let allVideos = [];               // All videos for the city
let availableDates = [];          // Unique dates with data
let availableHoursByDate = {};    // { "2025-12-01": [0, 1, 2, ...] }
let weatherChart = null;          // Chart.js instance
let lastCacheStatus = {           // Track cache status for UI indicators
    videos: 'UNKNOWN',
    weather: 'UNKNOWN',
    cities: 'UNKNOWN'
};

// =========================== DOM ELEMENTS ===================================
const homeView = document.getElementById("home-view");
const topicView = document.getElementById("topic-view");
const searchInput = document.getElementById("search-input");
const autocompleteDropdown = document.getElementById("autocomplete-dropdown");
const searchError = document.getElementById("search-error");
const loadingOverlay = document.getElementById("loading-overlay");
const selectionIndicator = document.getElementById("selection-indicator");

// =========================== INITIALIZATION =================================
document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    handleRouteChange();
});

window.addEventListener("hashchange", handleRouteChange);

function setupEventListeners() {
    // Autocomplete on input
    searchInput.addEventListener("input", debounce(handleSearchInput, 300));

    // Show all cities on focus (click to browse)
    searchInput.addEventListener("focus", handleSearchFocus);

    // Keyboard navigation
    searchInput.addEventListener("keydown", handleSearchKeydown);

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-input-wrapper")) {
            hideAutocomplete();
        }
    });

    // Date picker change
    const datePicker = document.getElementById("date-picker");
    if (datePicker) {
        datePicker.addEventListener("change", handleDateChange);
    }

    // Hour slider change
    const hourSlider = document.getElementById("hour-slider");
    if (hourSlider) {
        hourSlider.addEventListener("input", handleHourChange);
    }
}

// =========================== ROUTING ========================================
function handleRouteChange() {
    const hash = window.location.hash;

    if (hash.startsWith("#topic/")) {
        // Parse: #topic/CityName/CityId
        const parts = hash.substring(7).split("/");
        if (parts.length >= 2) {
            const cityName = decodeURIComponent(parts[0]);
            const cityId = parts[1];
            showTopicView(cityName, cityId);
        } else {
            navigateHome();
        }
    } else if (hash === "#upload") {
        showUploadView();
    } else {
        showHomeView();
    }
}

function navigateHome() {
    window.location.hash = "";
    showHomeView();
}

function navigateToTopic(city) {
    const encodedName = encodeURIComponent(city.name);
    window.location.hash = `topic/${encodedName}/${city.id}`;
}

function showHomeView() {
    homeView.style.display = "flex";
    topicView.style.display = "none";
    const uploadView = document.getElementById("upload-view");
    if (uploadView) uploadView.style.display = "none";
    searchInput.value = "";
    selectedCity = null;
    clearError();
    hideAutocomplete();
    updateSelectionState();
}

function showTopicView(cityName, cityId) {
    homeView.style.display = "none";
    topicView.style.display = "block";
    const uploadView = document.getElementById("upload-view");
    if (uploadView) uploadView.style.display = "none";
    document.getElementById("topic-title").textContent = cityName;
    loadTopicData(cityName, cityId);
}

function showUploadView() {
    homeView.style.display = "none";
    topicView.style.display = "none";
    const uploadView = document.getElementById("upload-view");
    if (uploadView) uploadView.style.display = "block";
}

// =========================== AUTOCOMPLETE ===================================

// Update visual feedback based on selection state
function updateSelectionState() {
    if (selectedCity) {
        searchInput.classList.add("selected");
        searchInput.classList.remove("invalid");
        if (selectionIndicator) {
            selectionIndicator.textContent = "✓";
            selectionIndicator.className = "selection-indicator valid";
        }
    } else {
        searchInput.classList.remove("selected");
        if (selectionIndicator) {
            selectionIndicator.textContent = "";
            selectionIndicator.className = "selection-indicator";
        }
    }
}

// Show dropdown when input is focused (browse all cities)
async function handleSearchFocus() {
    // If already has a selection, don't show dropdown
    if (selectedCity) return;

    const query = searchInput.value.trim();

    try {
        // Fetch cities (empty query returns all, or filter if user typed something)
        const cities = await fetchCities(query);

        if (cities.length > 0) {
            renderAutocomplete(cities, true); // true = show hint
        }
    } catch (error) {
        console.error("Focus autocomplete error:", error);
    }
}

async function handleSearchInput(e) {
    const query = searchInput.value.trim();
    clearError();

    // Reset selected city when user types
    selectedCity = null;
    updateSelectionState();

    if (query.length < 1) {
        // Show all cities when input is empty but focused
        handleSearchFocus();
        return;
    }

    try {
        const cities = await fetchCities(query);

        if (cities.length === 0) {
            renderNoResults();
            return;
        }

        renderAutocomplete(cities, true);
    } catch (error) {
        console.error("Autocomplete error:", error);
        hideAutocomplete();
    }
}

function renderAutocomplete(cities, showHint = false) {
    const hintHtml = showHint ? `<div class="dropdown-hint">Select a city from the list below</div>` : '';

    autocompleteDropdown.innerHTML = hintHtml + cities.map((city, index) => `
        <div class="autocomplete-item" data-index="${index}" data-id="${city.id}" data-name="${city.name}" data-country="${city.country || ''}">
            <span class="city-name">${city.name}</span>
            <span class="country">${city.country || ''}</span>
        </div>
    `).join("");

    // Add click handlers
    autocompleteDropdown.querySelectorAll(".autocomplete-item").forEach(item => {
        item.addEventListener("click", () => selectCity(item));
    });

    autocompleteDropdown.classList.add("show");
}

function renderNoResults() {
    autocompleteDropdown.innerHTML = `<div class="dropdown-hint">No cities found. Please try a different search.</div>`;
    autocompleteDropdown.classList.add("show");
}

function selectCity(element) {
    const city = {
        id: element.dataset.id,
        name: element.dataset.name,
        country: element.dataset.country
    };

    selectedCity = city;
    searchInput.value = city.name + (city.country ? `, ${city.country}` : "");
    hideAutocomplete();
    clearError();
    updateSelectionState();
}

function hideAutocomplete() {
    autocompleteDropdown.classList.remove("show");
    autocompleteDropdown.innerHTML = "";
}

function handleSearchKeydown(e) {
    const items = autocompleteDropdown.querySelectorAll(".autocomplete-item");
    const currentSelected = autocompleteDropdown.querySelector(".autocomplete-item.selected");
    let currentIndex = -1;

    if (currentSelected) {
        currentIndex = parseInt(currentSelected.dataset.index);
    }

    if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, items.length - 1);
        highlightItem(items, nextIndex);
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        highlightItem(items, prevIndex);
    } else if (e.key === "Enter") {
        e.preventDefault();
        if (currentSelected) {
            selectCity(currentSelected);
        }
        handleSearch();
    } else if (e.key === "Escape") {
        hideAutocomplete();
    }
}

function highlightItem(items, index) {
    items.forEach((item, i) => {
        item.classList.toggle("selected", i === index);
    });
}

// =========================== SEARCH VALIDATION ==============================
function handleSearch() {
    const inputValue = searchInput.value.trim();

    if (!inputValue) {
        showError("Please enter a city name to search.");
        showInvalidState();
        return;
    }

    if (!selectedCity) {
        showError("Please select a city from the dropdown list. Click the input and choose a city.");
        showInvalidState();
        return;
    }

    // Validate that input still matches selected city
    const expectedValue = selectedCity.name + (selectedCity.country ? `, ${selectedCity.country}` : "");
    if (inputValue !== expectedValue && inputValue !== selectedCity.name) {
        showError("Please select a city from the dropdown list. The entered text doesn't match your selection.");
        selectedCity = null;
        showInvalidState();
        return;
    }

    // Navigate to topic view
    navigateToTopic(selectedCity);
}

function showInvalidState() {
    searchInput.classList.add("invalid");
    searchInput.classList.remove("selected");
    if (selectionIndicator) {
        selectionIndicator.textContent = "✗";
        selectionIndicator.className = "selection-indicator invalid";
    }
    // Remove invalid class after animation
    setTimeout(() => {
        if (!selectedCity) {
            searchInput.classList.remove("invalid");
            if (selectionIndicator) {
                selectionIndicator.textContent = "";
                selectionIndicator.className = "selection-indicator";
            }
        }
    }, 500);
}

function showError(message) {
    searchError.textContent = message;
}

function clearError() {
    searchError.textContent = "";
}

// =========================== TOPIC VIEW DATA ================================
async function loadTopicData(cityName, cityId) {
    showLoading();
    console.log("=== LOAD TOPIC DATA ===");
    console.log("City:", cityName, "ID:", cityId);

    try {
        // Load videos and weather data in parallel
        const [videos, weather] = await Promise.all([
            fetchVideos(cityId),
            fetchWeather(cityId)
        ]);

        console.log("Videos from API:", videos);
        console.log("Weather from API:", weather);

        // Save videos globally for date filtering
        allVideos = videos || [];

        // Process weather data
        weatherData = weather;
        processWeatherDates(weather);

        // Add video dates to available dates
        addVideoDatesToAvailable(allVideos);

        // Populate date picker
        populateDatePicker();

        // Render initial chart and video for the first available date
        if (availableDates.length > 0) {
            const initialDate = availableDates[0];
            document.getElementById("date-picker").value = initialDate;
            updateHourSlider(initialDate);
            renderWeatherChart(initialDate);
            loadVideoForDate(initialDate);
        } else {
            document.getElementById("plot-message").textContent = "No weather data available for this city.";
            loadVideoForDate(null); // Show newest or no video
        }

    } catch (error) {
        console.error("Error loading topic data:", error);
        document.getElementById("video-message").textContent = "Error loading data. Please try again.";
        document.getElementById("plot-message").textContent = "Error loading data. Please try again.";
    } finally {
        hideLoading();
    }
}

function processWeatherDates(data) {
    availableDates = [];
    availableHoursByDate = {};

    if (!data || data.length === 0) return;

    // Group by date
    data.forEach(item => {
        const timestamp = new Date(item.timestamp);
        const dateStr = timestamp.toISOString().split("T")[0];
        const hour = timestamp.getHours();

        if (!availableHoursByDate[dateStr]) {
            availableHoursByDate[dateStr] = new Set();
            availableDates.push(dateStr);
        }
        availableHoursByDate[dateStr].add(hour);
    });

    // Sort dates
    availableDates.sort();

    // Convert sets to arrays
    Object.keys(availableHoursByDate).forEach(date => {
        availableHoursByDate[date] = Array.from(availableHoursByDate[date]).sort((a, b) => a - b);
    });
}

function addVideoDatesToAvailable(videos) {
    if (!videos || videos.length === 0) return;

    videos.forEach(video => {
        const videoDate = new Date(video.created_at).toISOString().split("T")[0];

        // Add to availableDates if not already present
        if (!availableDates.includes(videoDate)) {
            availableDates.push(videoDate);
            // Initialize empty hours array for video-only dates
            availableHoursByDate[videoDate] = [];
        }
    });

    // Re-sort dates
    availableDates.sort();

    console.log("Available dates after adding videos:", availableDates);
}

function populateDatePicker() {
    const datePicker = document.getElementById("date-picker");

    if (availableDates.length === 0) {
        datePicker.innerHTML = '<option value="">No dates available</option>';
        datePicker.disabled = true;
        return;
    }

    datePicker.disabled = false;
    datePicker.innerHTML = availableDates.map(date => {
        const formatted = new Date(date).toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric"
        });
        return `<option value="${date}">${formatted}</option>`;
    }).join("");
}

function handleDateChange(e) {
    const selectedDate = e.target.value;
    if (selectedDate) {
        updateHourSlider(selectedDate);
        renderWeatherChart(selectedDate);
        loadVideoForDate(selectedDate);
    }
}

function updateHourSlider(date) {
    const hourSlider = document.getElementById("hour-slider");
    const hourDisplay = document.getElementById("hour-display");
    const hoursInfo = document.getElementById("available-hours-info");

    const hours = availableHoursByDate[date] || [];

    if (hours.length === 0) {
        hourSlider.disabled = true;
        hourSlider.value = 0;
        hourDisplay.textContent = "0";
        hoursInfo.textContent = "No hourly data available";
        return;
    }

    hourSlider.disabled = false;
    hourSlider.min = Math.min(...hours);
    hourSlider.max = Math.max(...hours);
    hourSlider.value = hours[0];
    hourDisplay.textContent = hours[0];
    hoursInfo.textContent = `Available hours: ${hours.join(", ")}`;
}

function handleHourChange(e) {
    const hour = e.target.value;
    document.getElementById("hour-display").textContent = hour;

    // Optionally filter chart to show data up to this hour
    const selectedDate = document.getElementById("date-picker").value;
    renderWeatherChart(selectedDate, parseInt(hour));
}

// =========================== VIDEO LOADING ==================================
function loadVideoForDate(selectedDate) {
    const videoElement = document.getElementById("topic-video");
    const videoMessage = document.getElementById("video-message");

    console.log("=== VIDEO DEBUG ===");
    console.log("Selected date:", selectedDate);
    console.log("All videos:", allVideos);

    if (!allVideos || allVideos.length === 0) {
        videoElement.style.display = "none";
        videoMessage.textContent = "No video available for this city yet.";
        return;
    }

    // Find video that matches the selected date
    let matchingVideo = null;

    if (selectedDate) {
        matchingVideo = allVideos.find(video => {
            // Get video's created date in YYYY-MM-DD format
            const videoCreatedDate = new Date(video.created_at).toISOString().split("T")[0];

            console.log(`Video ID ${video.id}: created_at=${video.created_at}, parsed date=${videoCreatedDate}, match=${videoCreatedDate === selectedDate}`);

            return videoCreatedDate === selectedDate;
        });
    }

    console.log("Matching video:", matchingVideo);

    // Fallback to newest video if no match found
    const videoToShow = matchingVideo || allVideos[0];

    videoElement.style.display = "block";
    videoElement.src = videoToShow.video_url;

    const videoDate = new Date(videoToShow.created_at).toLocaleDateString();
    if (matchingVideo) {
        videoMessage.textContent = `Video from: ${videoDate}`;
    } else {
        videoMessage.textContent = `No video for selected date. Showing latest: ${videoDate}`;
    }
}

// =========================== WEATHER CHART ==================================
function renderWeatherChart(date, upToHour = 23) {
    const canvas = document.getElementById("weather-chart");
    const ctx = canvas.getContext("2d");

    // Filter data for selected date
    const dayData = weatherData.filter(item => {
        const timestamp = new Date(item.timestamp);
        const itemDate = timestamp.toISOString().split("T")[0];
        const itemHour = timestamp.getHours();
        return itemDate === date && itemHour <= upToHour;
    });

    if (dayData.length === 0) {
        document.getElementById("plot-message").textContent = "No data for selected date.";
        if (weatherChart) {
            weatherChart.destroy();
            weatherChart = null;
        }
        return;
    }

    document.getElementById("plot-message").textContent = "";

    // Calculate hourly averages
    const hourlyData = {};
    dayData.forEach(item => {
        const hour = new Date(item.timestamp).getHours();
        if (!hourlyData[hour]) {
            hourlyData[hour] = { temps: [], humidity: [], pressure: [], count: 0 };
        }
        if (item.temperature != null) hourlyData[hour].temps.push(parseFloat(item.temperature));
        if (item.humidity != null) hourlyData[hour].humidity.push(parseFloat(item.humidity));
        if (item.pressure != null) hourlyData[hour].pressure.push(parseFloat(item.pressure));
        hourlyData[hour].count++;
    });

    // Prepare chart data
    const hours = Object.keys(hourlyData).map(Number).sort((a, b) => a - b);
    const labels = hours.map(h => `${h}:00`);

    const avgTemp = hours.map(h => {
        const temps = hourlyData[h].temps;
        return temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
    });

    const avgHumidity = hours.map(h => {
        const hum = hourlyData[h].humidity;
        return hum.length > 0 ? hum.reduce((a, b) => a + b, 0) / hum.length : null;
    });

    const avgPressure = hours.map(h => {
        const pres = hourlyData[h].pressure;
        return pres.length > 0 ? pres.reduce((a, b) => a + b, 0) / pres.length : null;
    });

    // Destroy existing chart
    if (weatherChart) {
        weatherChart.destroy();
    }

    // Create new chart
    weatherChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Temperature (C)",
                    data: avgTemp,
                    borderColor: "#ea4335",
                    backgroundColor: "rgba(234, 67, 53, 0.1)",
                    yAxisID: "y-temp",
                    tension: 0.3
                },
                {
                    label: "Humidity (%)",
                    data: avgHumidity,
                    borderColor: "#4285f4",
                    backgroundColor: "rgba(66, 133, 244, 0.1)",
                    yAxisID: "y-humidity",
                    tension: 0.3
                },
                {
                    label: "Pressure (hPa)",
                    data: avgPressure,
                    borderColor: "#34a853",
                    backgroundColor: "rgba(52, 168, 83, 0.1)",
                    yAxisID: "y-pressure",
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: {
                    position: "top"
                },
                title: {
                    display: true,
                    text: `Weather Data for ${date}`
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: "Hour"
                    }
                },
                "y-temp": {
                    type: "linear",
                    display: true,
                    position: "left",
                    title: {
                        display: true,
                        text: "Temperature (C)"
                    }
                },
                "y-humidity": {
                    type: "linear",
                    display: true,
                    position: "right",
                    title: {
                        display: true,
                        text: "Humidity (%)"
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                "y-pressure": {
                    type: "linear",
                    display: false
                }
            }
        }
    });
}

// =========================== API CALLS ======================================

// --- Public API (READ) ---

async function fetchCities(search) {
    const { data, cacheStatus } = await publicApi.get('/cities', { search });
    lastCacheStatus.cities = cacheStatus;
    console.log(`Cities cache: ${cacheStatus}`);
    return data;
}

async function fetchVideos(cityId, startDate, endDate) {
    try {
        const { data, cacheStatus } = await publicApi.get('/videos', {
            city_id: cityId,
            start_date: startDate,
            end_date: endDate
        });
        lastCacheStatus.videos = cacheStatus;
        updateCacheIndicator('video-cache-status', cacheStatus);
        return data;
    } catch (error) {
        console.error("Error fetching videos:", error);
        return [];
    }
}

async function fetchWeather(cityId, startDate, endDate) {
    try {
        // Default to last 7 days if not specified
        const end = endDate || new Date().toISOString();
        const start = startDate || new Date(Date.now() - CONFIG.DEFAULT_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

        const { data, cacheStatus } = await publicApi.get('/weather', {
            city_id: cityId,
            start_date: start,
            end_date: end
        });
        lastCacheStatus.weather = cacheStatus;
        updateCacheIndicator('weather-cache-status', cacheStatus);
        return data;
    } catch (error) {
        console.error("Error fetching weather:", error);
        return [];
    }
}

async function fetchPhotos(cityId, startDate, endDate) {
    try {
        const { data, cacheStatus } = await publicApi.get('/photos', {
            city_id: cityId,
            start_date: startDate,
            end_date: endDate
        });
        console.log(`Photos cache: ${cacheStatus}`);
        return data;
    } catch (error) {
        console.error("Error fetching photos:", error);
        return [];
    }
}

// --- Webcams API (WRITE) ---

async function uploadPhoto(apiKey, imageBase64, title, metadata = {}) {
    return await webcamsApi.post('/photo', {
        image: imageBase64,
        title: title,
        metadata: JSON.stringify(metadata)
    }, apiKey);
}

async function uploadWeather(apiKey, temperature, humidity, pressure) {
    return await webcamsApi.post('/weather', {
        temperature: parseFloat(temperature),
        humidity: parseFloat(humidity),
        pressure: parseFloat(pressure)
    }, apiKey);
}

// --- Cache Indicator Helper ---

function updateCacheIndicator(elementId, status) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = status;
        element.className = `cache-indicator cache-${status.toLowerCase()}`;
    }
}

// =========================== UTILITIES ======================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showLoading() {
    loadingOverlay.style.display = "flex";
}

function hideLoading() {
    loadingOverlay.style.display = "none";
}

// Convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// =========================== WEBCAM UPLOAD HANDLERS ==========================

async function handlePhotoUpload(e) {
    e.preventDefault();

    const apiKey = document.getElementById('upload-api-key').value.trim();
    const fileInput = document.getElementById('upload-photo-file');
    const title = document.getElementById('upload-photo-title').value.trim();
    const statusEl = document.getElementById('upload-status');

    if (!apiKey) {
        statusEl.textContent = 'Error: API Key is required';
        statusEl.className = 'upload-status error';
        return;
    }

    if (!fileInput.files || fileInput.files.length === 0) {
        statusEl.textContent = 'Error: Please select an image file';
        statusEl.className = 'upload-status error';
        return;
    }

    if (!title) {
        statusEl.textContent = 'Error: Title is required';
        statusEl.className = 'upload-status error';
        return;
    }

    try {
        statusEl.textContent = 'Uploading...';
        statusEl.className = 'upload-status';

        const imageBase64 = await fileToBase64(fileInput.files[0]);
        const result = await uploadPhoto(apiKey, imageBase64, title);

        statusEl.textContent = `Success! Photo uploaded. ID: ${result.id}`;
        statusEl.className = 'upload-status success';

        // Clear form
        fileInput.value = '';
        document.getElementById('upload-photo-title').value = '';
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.className = 'upload-status error';
    }
}

async function handleWeatherUpload(e) {
    e.preventDefault();

    const apiKey = document.getElementById('upload-api-key').value.trim();
    const temperature = document.getElementById('upload-temperature').value;
    const humidity = document.getElementById('upload-humidity').value;
    const pressure = document.getElementById('upload-pressure').value;
    const statusEl = document.getElementById('upload-status');

    if (!apiKey) {
        statusEl.textContent = 'Error: API Key is required';
        statusEl.className = 'upload-status error';
        return;
    }

    if (!temperature || !humidity || !pressure) {
        statusEl.textContent = 'Error: All weather fields are required';
        statusEl.className = 'upload-status error';
        return;
    }

    try {
        statusEl.textContent = 'Uploading...';
        statusEl.className = 'upload-status';

        const result = await uploadWeather(apiKey, temperature, humidity, pressure);

        statusEl.textContent = `Success! Weather data uploaded. ID: ${result.id}`;
        statusEl.className = 'upload-status success';

        // Clear form
        document.getElementById('upload-temperature').value = '';
        document.getElementById('upload-humidity').value = '';
        document.getElementById('upload-pressure').value = '';
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.className = 'upload-status error';
    }
}
