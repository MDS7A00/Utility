// MQTT Client Logic using MQTT.js
// Ensure mqtt variable is available from global scope (loaded via script tag)

let client = null;

// UI Elements
const els = {
    host: document.getElementById('host'),
    port: document.getElementById('port'),
    path: document.getElementById('path'),
    clientId: document.getElementById('clientId'),
    username: document.getElementById('username'),
    password: document.getElementById('password'),
    btnConnect: document.getElementById('btn-connect'),
    btnDisconnect: document.getElementById('btn-disconnect'),
    status: document.getElementById('status-indicator'),
    topic: document.getElementById('topic'),
    btnSubscribe: document.getElementById('btn-subscribe'),
    activeSubscriptions: document.getElementById('active-subscriptions'),
    messageList: document.getElementById('message-list'),
    btnClear: document.getElementById('btn-clear')
};

// Generate random Client ID if empty
if (!els.clientId.value) {
    els.clientId.value = 'mqtt_client_' + Math.random().toString(16).substr(2, 8);
}

// State
let isConnected = false;
const subscriptions = new Set();

// Event Listeners
els.btnConnect.addEventListener('click', connect);
els.btnDisconnect.addEventListener('click', disconnect);
els.btnSubscribe.addEventListener('click', subscribe);
els.btnClear.addEventListener('click', () => els.messageList.innerHTML = '');

function updateStatus(status) {
    els.status.className = 'status ' + status.toLowerCase();
    els.status.textContent = status;

    if (status === 'Connected') {
        isConnected = true;
        els.btnConnect.disabled = true;
        els.btnDisconnect.disabled = false;
        els.btnSubscribe.disabled = false;
        disableInputs(true);
    } else if (status === 'Disconnected' || status === 'Error' || status.startsWith('Offline')) {
        isConnected = false;
        els.btnConnect.disabled = false;
        els.btnDisconnect.disabled = true;
        els.btnSubscribe.disabled = true;
        disableInputs(false);
        subscriptions.clear();
        renderSubscriptions();
    } else {
        // Connecting...
        els.btnConnect.disabled = true;
        els.btnDisconnect.disabled = false; // Allow canceling connection
        disableInputs(true);
    }
}

function disableInputs(disabled) {
    els.host.disabled = disabled;
    els.port.disabled = disabled;
    els.path.disabled = disabled;
    els.clientId.disabled = disabled;
    els.username.disabled = disabled;
    els.password.disabled = disabled;
}

function connect() {
    const protocol = 'wss';
    const host = els.host.value.trim();
    const port = parseInt(els.port.value.trim(), 10);
    const path = els.path.value.trim();
    const clientId = els.clientId.value.trim();
    const username = els.username.value.trim();
    const password = els.password.value.trim();

    if (!host || !port) {
        alert('Please enter Host and Port');
        return;
    }

    const url = `${protocol}://${host}:${port}${path}`;

    console.log(`Connecting to ${url} as ${clientId}...`);
    updateStatus('Connecting');

    const options = {
        clientId: clientId,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
        // Authentication
        username: username || undefined,
        password: password || undefined,
        // Browser specific: We simply ask the browser to handle certs (standard WSS behavior)
        rejectUnauthorized: false
    };

    try {
        client = mqtt.connect(url, options);

        client.on('connect', () => {
            console.log('Client connected');
            updateStatus('Connected');
            // Auto subscribe to the header topic if text is present
            if (els.topic.value.trim()) {
                subscribe();
            }
        });

        client.on('reconnect', () => {
            console.log('Reconnecting...');
            updateStatus('Connecting');
        });

        client.on('offline', () => {
            console.log('Client offline');
            updateStatus('Offline');
        });

        client.on('error', (err) => {
            console.error('Connection error:', err);
            updateStatus('Error');
            appendMessage('System', 'Error: ' + err.message);
            // client.end(); // Optional: force disconnect on error
        });

        client.on('message', (topic, message) => {
            // Buffer to string
            const payload = message.toString();
            appendMessage(topic, payload);
        });

    } catch (e) {
        console.error(e);
        updateStatus('Error');
        alert('Failed to initialize connection: ' + e.message);
    }
}

function disconnect() {
    if (client) {
        // Force close connection immediately
        client.end(true);
        client = null;
    }
    updateStatus('Disconnected');
}

function subscribe() {
    if (!client || !isConnected) return;

    const topic = els.topic.value.trim();
    if (!topic) return;

    if (subscriptions.has(topic)) return;

    client.subscribe(topic, { qos: 0 }, (err) => {
        if (!err) {
            subscriptions.add(topic);
            renderSubscriptions();
            console.log(`Subscribed to ${topic}`);
            appendMessage('System', `Subscribed to ${topic}`);
        } else {
            console.error('Subscribe error:', err);
            alert('Failed to subscribe');
        }
    });
}

function renderSubscriptions() {
    els.activeSubscriptions.innerHTML = '';
    subscriptions.forEach(sub => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.textContent = sub;
        els.activeSubscriptions.appendChild(tag);
    });
}

function appendMessage(topic, payload) {
    const item = document.createElement('div');
    item.className = 'message-item';

    const time = new Date().toLocaleTimeString();

    item.innerHTML = `
        <div class="message-meta">
            <span class="message-topic">${topic}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-payload">${escapeHtml(payload)}</div>
    `;

    els.messageList.prepend(item);

    // Limit history
    if (els.messageList.children.length > 200) {
        els.messageList.removeChild(els.messageList.lastChild);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
