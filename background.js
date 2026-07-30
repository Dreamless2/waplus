chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type !== 'inject-hook') return;
    if (!sender.tab?.id) return;

    const url = sender.tab.url || '';
    if (!url.startsWith('https://web.whatsapp.com')) {
        return;
    }

    chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        world: 'MAIN',
        func: hookWhatsAppWebSocketMain,
        args: [message.settings]
    }).catch((err) => {
        console.warn('[wa-ext] Falha ao injetar hook:', err.message);
    });
});

function hookWhatsAppWebSocketMain(initialSettings) {
    if (window.__waHookInstalled) return;
    window.__waHookInstalled = true;

    let localSettings = { ...initialSettings };

    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (event.data?.source === 'wa-ext' && event.data?.type === 'settings-update') {
            localSettings = { ...localSettings, ...event.data.settings };
        }
    });

    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function (...args) {
        const ws = new OriginalWebSocket(...args);
        const originalSend = ws.send;

        ws.send = function (data) {
            if (typeof data === 'string') {
                if (localSettings.typing && data.includes('"composing"')) return;
                if (localSettings.blueTicks && data.includes('"read"')) return;
                if (localSettings.audio && data.includes('"played"')) return;
            }
            return originalSend.apply(this, arguments);
        };
        return ws;
    };
}