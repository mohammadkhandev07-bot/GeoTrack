// ==========================================
// GeoTrack Pro - Satellite Edition
// ==========================================

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDMD-uKzz260AApt8GWDNH75JMNzzMRp20",
    authDomain: "geotrack-9c634.firebaseapp.com",
    databaseURL: "https://geotrack-9c634-default-rtdb.firebaseio.com",
    projectId: "geotrack-9c634",
    storageBucket: "geotrack-9c634.firebasestorage.app",
    messagingSenderId: "654252297836",
    appId: "1:654252297836:web:fd99dcbf8088013df49249"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Global State
const state = {
    userId: null,
    username: null,
    roomId: 'public',
    map: null,
    markers: {},
    users: {},
    watchId: null,
    sessionStart: null,
    currentUser: null,
    isSatellite: true,
    layers: {}
};

// Color Palette
const colors = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', 
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

// ==========================================
// Utility Functions
// ==========================================

const generateId = () => `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];
const formatTime = (date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function updateSessionTime() {
    if (!state.sessionStart) return;
    
    const diff = Date.now() - state.sessionStart;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    document.getElementById('session-time').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ==========================================
// 🛰️ SATELLITE MAP FUNCTIONS
// ==========================================

function initMap() {
    // Initialize map
    state.map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([20.5937, 78.9629], 5);

    // 🛰️ SATELLITE LAYER (Esri World Imagery - High Quality)
    const satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 
        {
            attribution: 'Satellite imagery by Esri',
            maxZoom: 19,
            subdomains: ['server', 'services']
        }
    );

    // 🏷️ LABELS LAYER (Road names, cities on top)
    const labelsLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
            maxZoom: 19,
            opacity: 0.9
        }
    );

    // 🗺️ STREET LAYER (For switching)
    const streetLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            maxZoom: 19,
            subdomains: 'abcd'
        }
    );

    // Add satellite by default
    satelliteLayer.addTo(state.map);
    labelsLayer.addTo(state.map);

    // Store layers
    state.layers = {
        satellite: satelliteLayer,
        labels: labelsLayer,
        street: streetLayer
    };

    // Zoom control
    L.control.zoom({
        position: 'bottomright'
    }).addTo(state.map);
}

// 🔄 SWITCH MAP STYLE
function toggleMapStyle() {
    const badge = document.getElementById('map-style-badge');
    
    if (state.isSatellite) {
        // Switch to Street View
        state.map.removeLayer(state.layers.satellite);
        state.map.removeLayer(state.layers.labels);
        state.layers.street.addTo(state.map);
        
        badge.innerHTML = '<i class="fas fa-road"></i><span>Street</span>';
        showToast('Switched to Street View', 'info');
    } else {
        // Switch to Satellite
        state.map.removeLayer(state.layers.street);
        state.layers.satellite.addTo(state.map);
        state.layers.labels.addTo(state.map);
        
        badge.innerHTML = '<i class="fas fa-satellite"></i><span>Satellite</span>';
        showToast('Switched to Satellite View', 'info');
    }
    
    state.isSatellite = !state.isSatellite;
}

// ==========================================
// Marker Functions
// ==========================================

function createCustomMarker(color, label, isCurrentUser = false) {
    const size = isCurrentUser ? 48 : 40;
    const pulse = isCurrentUser ? '<div class="marker-pulse" style="background: ' + color + '"></div>' : '';
    
    return L.divIcon({
        className: 'custom-marker',
        html: `
            ${pulse}
            <div class="marker-pin" style="background: ${color}; width: ${size}px; height: ${size}px; font-size: ${isCurrentUser ? 16 : 14}px;">
                ${label.charAt(0).toUpperCase()}
            </div>
        `,
        iconSize: [size, size + 10],
        iconAnchor: [size / 2, size + 10]
    });
}

function updateMarker(userId, userData) {
    const isCurrentUser = userId === state.userId;
    const position = [userData.lat, userData.lng];
    
    if (state.markers[userId]) {
        state.markers[userId].setLatLng(position);
        state.markers[userId].getPopup().setContent(createPopupContent(userData, isCurrentUser));
    } else {
        const marker = L.marker(position, {
            icon: createCustomMarker(userData.color, userData.name, isCurrentUser)
        }).addTo(state.map);
        
        marker.bindPopup(createPopupContent(userData, isCurrentUser));
        
        if (isCurrentUser) {
            marker.bindTooltip('You', { 
                permanent: true, 
                direction: 'top',
                offset: [0, -25]
            });
        }
        
        state.markers[userId] = marker;
    }
}

function createPopupContent(user, isCurrentUser) {
    const time = formatTime(new Date(user.timestamp));
    const accuracy = user.accuracy ? `±${Math.round(user.accuracy)}m` : 'Unknown';
    
    return `
        <div style="min-width: 200px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <div style="width: 36px; height: 36px; background: ${user.color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                    ${user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <div style="font-weight: 600; color: #fff;">${user.name} ${isCurrentUser ? '(You)' : ''}</div>
                    <div style="font-size: 12px; color: #94a3b8;">${time}</div>
                </div>
            </div>
            <div style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
                <div><strong>Accuracy:</strong> ${accuracy}</div>
                <div><strong>Coordinates:</strong> ${user.lat.toFixed(6)}, ${user.lng.toFixed(6)}</div>
            </div>
        </div>
    `;
}

function removeMarker(userId) {
    if (state.markers[userId]) {
        state.map.removeLayer(state.markers[userId]);
        delete state.markers[userId];
    }
}

function fitMapToAllUsers() {
    const markers = Object.values(state.markers);
    if (markers.length === 0) return;
    
    const group = new L.featureGroup(markers);
    state.map.fitBounds(group.getBounds().pad(0.2));
}

// ==========================================
// UI Functions
// ==========================================

function createUserCard(userId, userData) {
    const isCurrentUser = userId === state.userId;
    const time = formatTime(new Date(userData.timestamp));
    
    const card = document.createElement('div');
    card.className = `user-card ${isCurrentUser ? 'active' : ''}`;
    card.dataset.userId = userId;
    
    card.innerHTML = `
        <div class="user-avatar" style="background: ${userData.color}; ${!isCurrentUser ? '' : 'box-shadow: 0 0 0 2px var(--primary)'}">
            ${userData.name.charAt(0).toUpperCase()}
        </div>
        <div class="user-info">
            <div class="user-name">${userData.name} ${isCurrentUser ? '(You)' : ''}</div>
            <div class="user-meta">Updated ${time}</div>
        </div>
        ${!isCurrentUser ? `<div class="user-distance" id="dist-${userId}">-- km</div>` : ''}
    `;
    
    card.addEventListener('click', () => {
        if (state.markers[userId]) {
            state.map.setView([userData.lat, userData.lng], 16);
            state.markers[userId].openPopup();
        }
    });
    
    return card;
}

function updateUsersList(users) {
    const container = document.getElementById('users-list');
    
    container.innerHTML = '';
    
    if (users[state.userId]) {
        container.appendChild(createUserCard(state.userId, users[state.userId]));
    }
    
    Object.keys(users).forEach(userId => {
        if (userId !== state.userId) {
            container.appendChild(createUserCard(userId, users[userId]));
        }
    });
    
    document.getElementById('user-count').textContent = Object.keys(users).length;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
}

// ==========================================
// Location Functions
// ==========================================

function startLocationTracking() {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser', 'error');
        return;
    }
    
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };
    
    navigator.geolocation.getCurrentPosition(handlePosition, handleLocationError, options);
    state.watchId = navigator.geolocation.watchPosition(handlePosition, handleLocationError, options);
}

function handlePosition(position) {
    const { latitude, longitude, accuracy } = position.coords;
    
    const userData = {
        name: state.username,
        lat: latitude,
        lng: longitude,
        accuracy: accuracy,
        timestamp: Date.now(),
        color: state.currentUser?.color || getRandomColor()
    };
    
    database.ref(`rooms/${state.roomId}/users/${state.userId}`).set(userData);
    state.currentUser = userData;
    updateMarker(state.userId, userData);
}

function handleLocationError(error) {
    let message = 'Unable to retrieve your location';
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = 'Location access denied. Please enable location permissions.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Location information unavailable.';
            break;
        case error.TIMEOUT:
            message = 'Location request timed out.';
            break;
    }
    
    showToast(message, 'error');
}

// ==========================================
// Firebase Listeners
// ==========================================

function setupFirebaseListeners() {
    const roomRef = database.ref(`rooms/${state.roomId}/users`);
    
    roomRef.on('value', (snapshot) => {
        const users = snapshot.val() || {};
        state.users = users;
        
        updateUsersList(users);
        
        Object.keys(users).forEach(userId => {
            if (userId !== state.userId) {
                updateMarker(userId, users[userId]);
            }
        });
        
        Object.keys(state.markers).forEach(userId => {
            if (!users[userId]) {
                removeMarker(userId);
            }
        });
        
        if (state.currentUser) {
            Object.keys(users).forEach(userId => {
                if (userId !== state.userId && users[userId]) {
                    const dist = calculateDistance(
                        state.currentUser.lat, state.currentUser.lng,
                        users[userId].lat, users[userId].lng
                    );
                    const distEl = document.getElementById(`dist-${userId}`);
                    if (distEl) distEl.textContent = `${dist} km`;
                }
            });
        }
    });
    
    roomRef.child(state.userId).onDisconnect().remove();
}

// ==========================================
// Event Handlers
// ==========================================

function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('user-name').value.trim();
    const roomId = document.getElementById('room-id').value.trim() || 'public';
    
    if (!username) {
        showToast('Please enter your name', 'error');
        return;
    }
    
    state.userId = generateId();
    state.username = username;
    state.roomId = roomId;
    state.sessionStart = Date.now();
    state.currentUser = {
        name: username,
        color: getRandomColor()
    };
    
    document.getElementById('display-username').textContent = username;
    document.getElementById('user-avatar').textContent = username.charAt(0).toUpperCase();
    
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    
    initMap();
    setupFirebaseListeners();
    startLocationTracking();
    setInterval(updateSessionTime, 1000);
    
    showToast(`Welcome to GeoTrack Pro, ${username}!`, 'success');
}

function handleLogout() {
    if (state.watchId) {
        navigator.geolocation.clearWatch(state.watchId);
    }
    
    database.ref(`rooms/${state.roomId}/users/${state.userId}`).remove();
    location.reload();
}

function handleShare() {
    const modal = document.getElementById('share-modal');
    const urlInput = document.getElementById('share-url');
    const qrContainer = document.getElementById('qr-code');
    
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${state.roomId}`;
    urlInput.value = shareUrl;
    
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
        text: shareUrl,
        width: 180,
        height: 180,
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
    
    modal.classList.add('active');
}

function copyShareLink() {
    const urlInput = document.getElementById('share-url');
    urlInput.select();
    document.execCommand('copy');
    showToast('Link copied to clipboard!', 'success');
}

// ==========================================
// Initialization
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.getElementById('loader').classList.add('hidden');
    }, 1500);
    
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        document.getElementById('room-id').value = roomParam;
    }
    
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('btn-logout').addEventListener('click', handleLogout);
    document.getElementById('btn-share').addEventListener('click', handleShare);
    document.getElementById('btn-layer').addEventListener('click', toggleMapStyle);
    document.getElementById('btn-locate-me').addEventListener('click', () => {
        if (state.currentUser) {
            state.map.setView([state.currentUser.lat, state.currentUser.lng], 16);
        }
    });
    document.getElementById('btn-fit-all').addEventListener('click', fitMapToAllUsers);
    document.getElementById('btn-copy-link').addEventListener('click', copyShareLink);
    
    document.querySelector('.btn-close').addEventListener('click', () => {
        document.getElementById('share-modal').classList.remove('active');
    });
    
    document.getElementById('share-modal').addEventListener('click', (e) => {
        if (e.target.id === 'share-modal') {
            document.getElementById('share-modal').classList.remove('active');
        }
    });
    
    window.addEventListener('beforeunload', () => {
        if (state.userId) {
            database.ref(`rooms/${state.roomId}/users/${state.userId}`).remove();
        }
    });
});
