const API_KEY = '60f912f8aa428814a8c882d8945607d9';
const WEATHER_API_BASE = 'https://api.openweathermap.org/data/2.5';
const GEO_API_BASE = 'https://api.openweathermap.org/geo/1.0';
const AQI_API_BASE = 'https://api.openweathermap.org/data/2.5/air_pollution';

let currentUnit = 'celsius';
let currentTheme = 'light';
let recentCities = JSON.parse(localStorage.getItem('recentCities')) || [];
let map;

const searchInput = document.querySelector('.search-input');
const searchResults = document.querySelector('.search-results');
const locationBtn = document.getElementById('location-btn');
const unitToggle = document.getElementById('unit-toggle');
const themeToggle = document.getElementById('theme-toggle');
const dateTimeElement = document.getElementById('date-time');
const clearBtn = document.querySelector('.clear-btn');
const recentCitiesContainer = document.getElementById('recent-cities');
const aqiIcon = document.getElementById('aqi-icon');

const aqiLevels = [
    { level: 1, text: 'Excellent', icon: 'fas fa-grin-stars', color: 'blue' },
    { level: 2, text: 'Good', icon: 'fas fa-smile', color: 'green' },
    { level: 3, text: 'Moderate', icon: 'fas fa-meh', color: 'yellow' },
    { level: 4, text: 'Poor', icon: 'fas fa-frown', color: 'orange' },
    { level: 5, text: 'Very Poor', icon: 'fas fa-sad-tear', color: 'red' },
    { level: 6, text: 'Hazardous', icon: 'fas fa-skull-crossbones', color: 'purple' }
];

function initialize() {
    setupEventListeners();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    updateRecentCities();
    searchInput.focus();

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                fetchWeatherByCoords(latitude, longitude);
            },
            error => {
                console.error('Geolocation error:', error);
                fetchWeatherByCoords(51.5074, -0.1278);
            }
        );
    }
}

function setupEventListeners() {
    themeToggle.addEventListener('click', toggleTheme);
    unitToggle.addEventListener('click', toggleUnit);
    searchInput.addEventListener('input', debounce(handleSearch, 500));
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query.length < 3) {
                alert('Please enter at least 3 characters to search.');
                return;
            }
            handleSearch({ target: { value: query } });
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            navigateSearchResults(e.key);
        } else if (e.key === 'Escape') {
            searchInput.value = '';
            searchResults.style.display = 'none';
        }
    });
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchResults.style.display = 'none';
        clearBtn.style.display = 'none';
    });
    locationBtn.addEventListener('click', handleLocationRequest);
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });

    document.getElementById('reload-logo').addEventListener('click', () => {
        window.location.reload();
    });
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    themeToggle.innerHTML = currentTheme === 'light' 
        ? '<i class="fas fa-moon"></i>' 
        : '<i class="fas fa-sun"></i>';
    localStorage.setItem('theme', currentTheme);
}

function toggleUnit() {
    currentUnit = currentUnit === 'celsius' ? 'fahrenheit' : 'celsius';
    unitToggle.innerHTML = currentUnit === 'celsius'
        ? '<i class="fas fa-temperature-high"></i>°C'
        : '<i class="fas fa-temperature-high"></i>°F';
    updateTemperatureDisplays();
    localStorage.setItem('unit', currentUnit);
}

function convertTemp(temp, to = currentUnit) {
    if (to === 'fahrenheit') {
        return ((temp * 9 / 5) + 32).toFixed(1);
    } else {
        return ((temp - 32) * 5 / 9).toFixed(1);
    }
}

function updateDateTime() {
    const now = new Date();
    dateTimeElement.textContent = now.toLocaleString();
}

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

async function handleSearch(e) {
    const query = e.target.value.trim();
    if (query.length < 3) {
        searchResults.style.display = 'none';
        return;
    }

    try {
        const cities = await fetchCities(query);
        if (cities.length === 0) {
            alert('No city found. Please try again.');
            return;
        }
        displaySearchResults(cities);
    } catch (error) {
        console.error('Error fetching cities:', error);
    }
}

function handleLocationRequest() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                fetchWeatherByCoords(latitude, longitude);
            },
            error => {
                console.error('Error getting location:', error);
                alert('Unable to retrieve your location. Please search for a city instead.');
            }
        );
    } else {
        alert('Geolocation is not supported by your browser');
    }
}

async function fetchCities(query) {
    const response = await fetch(
        `${GEO_API_BASE}/direct?q=${query}&limit=5&appid=${API_KEY}`
    );
    return await response.json();
}

async function fetchWeatherByCoords(lat, lon) {
    try {
        const units = currentUnit === 'celsius' ? 'metric' : 'imperial';
        const [current, forecast, aqi] = await Promise.all([
            fetch(`${WEATHER_API_BASE}/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`),
            fetch(`${WEATHER_API_BASE}/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`),
            fetch(`${AQI_API_BASE}?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
        ]);

        const currentData = await current.json();
        const forecastData = await forecast.json();
        const aqiData = await aqi.json();

        updateWeatherDisplay(currentData);
        updateForecastDisplays(forecastData);
        updateAQIDisplay(aqiData);
        addRecentCity(currentData.name, currentData.sys.country);
        initializeMap(lat, lon);
    } catch (error) {
        console.error('Error fetching weather:', error);
        alert('Error fetching weather data. Please try again.');
    }
}

function initializeMap(lat, lon) {
    if (!map) {
        map = L.map('map').setView([lat, lon], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    } else {
        map.setView([lat, lon], 10);
    }
    L.marker([lat, lon]).addTo(map)
        .bindPopup('You are here')
        .openPopup();

    initializeWindyMap(lat, lon);
}

function initializeWindyMap(lat, lon) {
    const windyMap = document.getElementById('windy-map');
    windyMap.src = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&zoom=10&level=surface&overlay=wind&menu=&message=&marker=&calendar=&pressure=&type=map&location=coordinates&detail=&detailLat=${lat}&detailLon=${lon}&metricWind=km%2Fh&metricTemp=%C2%B0C`;
    windyMap.style.display = 'block';
    document.getElementById('map').style.display = 'none';
}

function displaySearchResults(cities) {
    searchResults.innerHTML = '';
    searchResults.style.display = cities.length ? 'block' : 'none';

    cities.forEach((city, index) => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.textContent = `${city.name}, ${city.country}`;
        div.tabIndex = 0;
        div.addEventListener('click', () => {
            fetchWeatherByCoords(city.lat, city.lon);
            searchResults.style.display = 'none';
            searchInput.value = `${city.name}, ${city.country}`;
        });
        div.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                fetchWeatherByCoords(city.lat, city.lon);
                searchResults.style.display = 'none';
                searchInput.value = `${city.name}, ${city.country}`;
            }
        });
        searchResults.appendChild(div);
    });
}

function updateWeatherDisplay(data) {
    document.querySelector('.city-name').textContent = data.name;
    document.querySelector('.temperature').textContent = 
        `${data.main.temp.toFixed(1)}°${currentUnit === 'celsius' ? 'C' : 'F'}`;
    document.querySelector('.weather-description').textContent = 
        data.weather[0].description;
    document.querySelector('.weather-icon').src = 
        `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    document.getElementById('feels-like').textContent = 
        `${data.main.feels_like.toFixed(1)}°${currentUnit === 'celsius' ? 'C' : 'F'}`;
    document.getElementById('humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('wind-speed').textContent = `${data.wind.speed} km/h`;
    document.getElementById('pressure').textContent = `${data.main.pressure} hPa`;
}

function updateAQIDisplay(data) {
    const aqi = data.list[0].main.aqi;
    const aqiInfo = aqiLevels.find(level => level.level === aqi);
    if (aqiInfo) {
        aqiIcon.className = aqiInfo.icon;
        aqiIcon.style.color = aqiInfo.color;
        document.getElementById('aqi').textContent = `${aqiInfo.text} (${aqi})`;
    }
}

function updateForecastDisplays(data) {
    const hourlyContainer = document.getElementById('hourly-forecast');
    hourlyContainer.innerHTML = '';
    
    data.list.slice(0, 8).forEach(item => {
        const hour = new Date(item.dt * 1000).getHours();
        const div = document.createElement('div');
        div.className = 'forecast-card';
        div.innerHTML = `
            <p>${hour}:00</p>
            <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" alt="Weather icon">
            <p class="temperature">${item.main.temp.toFixed(1)}°${currentUnit === 'celsius' ? 'C' : 'F'}</p>
            <p>${item.weather[0].description}</p>
        `;
        hourlyContainer.appendChild(div);
    });

    const dailyContainer = document.getElementById('daily-forecast');
    dailyContainer.innerHTML = '';

    const dailyData = data.list.filter((item, index) => index % 8 === 0);
    dailyData.forEach(item => {
        const date = new Date(item.dt * 1000);
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
        const div = document.createElement('div');
        div.className = 'forecast-card';
        div.innerHTML = `
            <p>${day}</p>
            <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" alt="Weather icon">
            <p class="temperature">${item.main.temp.toFixed(1)}°${currentUnit === 'celsius' ? 'C' : 'F'}</p>
            <p>${item.weather[0].description}</p>
        `;
        dailyContainer.appendChild(div);
    });
}

function updateTemperatureDisplays() {
    const temperatureElements = document.querySelectorAll('.temperature');
    temperatureElements.forEach(element => {
        const tempValue = parseFloat(element.textContent);
        if (!isNaN(tempValue)) {
            element.textContent = `${convertTemp(tempValue)}°${currentUnit === 'celsius' ? 'C' : 'F'}`;
        }
    });

    const feelsLikeElement = document.getElementById('feels-like');
    const feelsLikeValue = parseFloat(feelsLikeElement.textContent);
    if (!isNaN(feelsLikeValue)) {
        feelsLikeElement.textContent = `${convertTemp(feelsLikeValue)}°${currentUnit === 'celsius' ? 'C' : 'F'}`;
    }
}

function addRecentCity(cityName, countryCode) {
    const city = `${cityName}, ${countryCode}`;
    if (!recentCities.includes(city)) {
        recentCities.unshift(city);
        if (recentCities.length > 5) {
            recentCities.pop();
        }
        localStorage.setItem('recentCities', JSON.stringify(recentCities));
        updateRecentCities();
    }
}

function updateRecentCities() {
    recentCitiesContainer.innerHTML = '';
    recentCities.forEach(city => {
        const div = document.createElement('div');
        div.className = 'recent-city';
        div.textContent = city;
        div.addEventListener('click', () => {
            const [cityName, countryCode] = city.split(', ');
            fetchWeatherByCityName(cityName, countryCode);
        });
        recentCitiesContainer.appendChild(div);
    });
}

async function fetchWeatherByCityName(cityName, countryCode) {
    try {
        const response = await fetch(
            `${GEO_API_BASE}/direct?q=${cityName},${countryCode}&limit=1&appid=${API_KEY}`
        );
        const data = await response.json();
        if (data.length > 0) {
            const { lat, lon } = data[0];
            fetchWeatherByCoords(lat, lon);
        } else {
            alert('City not found');
        }
    } catch (error) {
        console.error('Error fetching city coordinates:', error);
        alert('Error fetching city coordinates. Please try again.');
    }
}

function navigateSearchResults(direction) {
    const results = document.querySelectorAll('.search-result-item');
    if (results.length === 0) return;

    let currentIndex = -1;
    results.forEach((result, index) => {
        if (result.classList.contains('highlighted')) {
            currentIndex = index;
            result.classList.remove('highlighted');
        }
    });

    if (direction === 'ArrowDown') {
        currentIndex = (currentIndex + 1) % results.length;
    } else if (direction === 'ArrowUp') {
        currentIndex = (currentIndex - 1 + results.length) % results.length;
    }

    results[currentIndex].classList.add('highlighted');
    results[currentIndex].focus();
    results[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

initialize();