let settings = {
    typing: false,
    blueTicks: false,
    audio: false
};

function updateSettings() {
    const options = ['typing', 'blueTicks', 'audio'];
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(options, (result) => {
            Object.assign(settings, result);
        });
    }
}
function hookWhatsAppWebSocket() {
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function (...args) {
        const ws = new OriginalWebSocket(...args);
        const originalSend = ws.send;

        ws.send = function (data) {
            if (typeof data === 'string') {
                if (settings.typing && data.includes('"composing"')) return;
                if (settings.blueTicks && data.includes('"read"')) return;
                if (settings.audio && data.includes('"played"')) return;
            }
            return originalSend.apply(this, arguments);
        };
        return ws;
    };
}

window.addEventListener('beforeunload', (e) => {
    e.stopImmediatePropagation();
}, true);

Object.defineProperty(window, 'onbeforeunload', {
    set: function () { },
    get: function () { return null; },
    configurable: false
});

hookWhatsAppWebSocket();
updateSettings();

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(() => {
        updateSettings();
    });
}
