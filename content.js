let settings = {
    status: true,
    typing: false,
    blueTicks: false,
    audio: false,
    hideOnline: true
};

function updateSettings() {
    chrome.storage.local.get(['status', 'typing', 'blueTicks', 'audio'], (result) => {
        Object.assign(settings, result);

        const btn = document.getElementById('btn-download-status-native');
        if (!settings.status && btn) {
            btn.remove();
        }

        window.postMessage({ source: 'wa-ext', type: 'settings-update', settings }, '*');
    });
}

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
                if (localSettings.hideOnline) {
                    if (data.includes('"available"') || data.includes('"unavailable"') ||
                        data.includes('presence') || data.includes('"type":"available"')) {
                        return;
                    }
                }
            }
            return originalSend.apply(this, arguments);
        };
        return ws;
    };
}

function injectHook() {
    chrome.runtime.sendMessage({ type: 'inject-hook', settings });
}

function findCloseButton(root) {
    if (!root) return null;

    const titles = Array.from(root.querySelectorAll('title'));
    const closeTitle = titles.find(el => el.textContent === 'ic-close');
    if (closeTitle) return closeTitle.closest('.html-div.x6s0dn4.x78zum5.x1vjfegm');

    const elements = root.querySelectorAll('*');
    for (const el of elements) {
        if (el.shadowRoot) {
            const found = findCloseButton(el.shadowRoot);
            if (found) return found;
        }
    }
    return null;
}

function injectNativeButton() {
    if (!settings.status) return;
    if (document.getElementById('btn-download-status-native')) return;

    const closeButtonContainer = findCloseButton(document);
    if (!closeButtonContainer) return;

    const targetRow = closeButtonContainer.parentElement;
    if (!targetRow) return;

    const btn = document.createElement('div');
    btn.id = 'btn-download-status-native';
    btn.className = 'html-div xdj266r x14z9mp xat24cr x1lziwak xexx8yu xyri2b x18d9i69 x1c1uobl x6s0dn4 x78zum5 x1vjfegm';
    btn.style.cursor = 'pointer';
    btn.style.marginRight = '32px';
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.color = '#fff';

    btn.innerHTML = `
        <span aria-hidden="true" class="xxk0z11 xvy4d1p">
            <svg viewBox="0 0 24 24" height="24" width="24" preserveAspectRatio="xMidYMid meet" fill="currentColor">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
            </svg>
        </span>
    `;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const video = document.querySelector('video');
        const img = document.querySelector('img[src^="blob:"]') || document.querySelector('img');
        let mediaUrl = null;

        if (video && video.src) mediaUrl = video.src;
        else if (img && img.src) mediaUrl = img.src;

        if (mediaUrl) {
            const a = document.createElement('a');
            a.href = mediaUrl;
            a.download = `whatsapp_status_${Date.now()}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert('Error: Media not found!');
        }
    });

    targetRow.insertBefore(btn, closeButtonContainer);
}

chrome.storage.onChanged.addListener(() => {
    updateSettings();
});

const observer = new MutationObserver(() => {
    injectNativeButton();
});

observer.observe(document.documentElement, { childList: true, subtree: true });

updateSettings();
injectHook();

function startAntiDelete() {
    if (!document.body) {
        setTimeout(startAntiDelete, 300);
        return;
    }

    if (window.__waAntiDeleteInstalled) return;
    window.__waAntiDeleteInstalled = true;

    const MAX_CACHE_SIZE = 5000;
    const DELETED_MARKERS = [
        'Mensagem apagada',
        'This message was deleted',
        'Se eliminó este mensaje',
        'Ce message a été supprimé',
        'Diese Nachricht wurde gelöscht',
        'Questo messaggio è stato eliminato'
    ];

    const messageCache = new Map();

    function isDeletedText(text) {
        return DELETED_MARKERS.some(marker => text.includes(marker));
    }

    function pruneCache() {
        if (messageCache.size <= MAX_CACHE_SIZE) return;
        const excess = messageCache.size - MAX_CACHE_SIZE;
        const keys = messageCache.keys();
        for (let i = 0; i < excess; i++) {
            messageCache.delete(keys.next().value);
        }
    }

    function getMessageText(msg) {
        const textEl = msg.querySelector('.copyable-text span[dir], .selectable-text, span[dir]');
        return textEl ? textEl.innerText : '';
    }

    function cacheMessage(msg) {
        const id = msg.getAttribute('data-id');
        if (!id || messageCache.has(id) || msg.hasAttribute('data-ext-deleted')) return;

        const text = getMessageText(msg);
        const time = msg.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text') || '';

        if (text && !isDeletedText(text)) {
            messageCache.set(id, { text, time, element: msg });
            pruneCache();
        }
    }

    function renderRecovered(msgContainer, cached) {
        msgContainer.setAttribute('data-ext-deleted', 'true');

        const currentTextEl = msgContainer.querySelector('.selectable-text, span[dir]');
        const textContainer = msgContainer.querySelector('.selectable-text')?.parentElement || currentTextEl?.parentElement;
        if (!textContainer) return;

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'border-left: 3px solid #ff5555; padding-left: 8px; margin: 4px 0; color: #ffcccc;';

        const label = document.createElement('strong');
        label.style.cssText = 'color:#ff5555; font-size: 12px;';
        label.textContent = '[Recuperada]';

        wrapper.appendChild(label);
        wrapper.appendChild(document.createElement('br'));
        wrapper.appendChild(document.createTextNode(cached.text));

        textContainer.innerHTML = '';
        textContainer.appendChild(wrapper);
    }

    function handleMutation(mut) {
        let targetNode = mut.target;
        if (targetNode.nodeType === 3) {
            targetNode = targetNode.parentElement;
        }

        const msgContainer = targetNode?.closest('[data-id]');
        if (!msgContainer) {
            Array.from(mut.addedNodes).forEach(node => {
                if (node.nodeType !== 1) return;
                if (node.hasAttribute?.('data-id')) {
                    cacheMessage(node);
                }
                node.querySelectorAll?.('[data-id]').forEach(cacheMessage);
            });
            return;
        }

        const id = msgContainer.getAttribute('data-id');
        if (!id || msgContainer.hasAttribute('data-ext-deleted')) return;

        if (!messageCache.has(id)) {
            cacheMessage(msgContainer);
            return;
        }

        const currentText = getMessageText(msgContainer);
        if (isDeletedText(currentText)) {
            const cached = messageCache.get(id);
            renderRecovered(msgContainer, cached);
        }
    }

    function startObserving() {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(handleMutation);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    document.querySelectorAll('[data-id]').forEach(cacheMessage);
    startObserving();
}

if (settings.antiDelete) {
    startAntiDelete();
}


function setupOnlineNotifier() {
    let lastStatus = {};

    const checkOnline = () => {
        let activeContactName = null;
        const header = document.querySelector('[data-testid="conversation-info-header"]') || document.querySelector('header');

        if (header) {
            const subtitle = header.querySelector('span[title], span[dir="auto"]');
            const nameEl = header.querySelector('span[dir="auto"]');
            const name = nameEl ? nameEl.innerText : 'Contact';
            activeContactName = name;
            const status = subtitle ? subtitle.innerText.toLowerCase() : '';

            if (status.includes('online') || status.includes('typing') || status.includes('composing') || status.includes('recording')) {
                if (lastStatus[name] !== 'online') {
                    lastStatus[name] = 'online';
                    notify(`${name} is online!`);
                }
            } else {
                if (lastStatus[name] === 'online') {
                    lastStatus[name] = 'offline';
                }
            }
        }

        document.querySelectorAll('[data-testid="cell-frame-container"]').forEach(cell => {
            const name = cell.querySelector('span[dir="auto"]')?.innerText;
            if (!name || name === activeContactName) return;

            const isOnline = cell.querySelector('span[title*="online" i], span[title*="Online"]') !== null;

            if (isOnline) {
                if (lastStatus[name] !== 'online') {
                    lastStatus[name] = 'online';
                    notify(`${name} is online!`);
                }
            } else {
                if (lastStatus[name] === 'online') {
                    lastStatus[name] = 'offline';
                }
            }
        });
    };

    function notify(msg) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('WhatsApp', { body: msg, icon: 'https://web.whatsapp.com/favicon.ico' });
        }
        showToast(msg);
    }

    function showToast(text) {
        const toast = document.createElement('div');
        toast.textContent = text;
        toast.style.cssText = `
            position: fixed; bottom: 30px; left: 30px; z-index: 999999;
            background: #25D366; color: white; padding: 12px 20px;
            border-radius: 8px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif; pointer-events: none;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    setInterval(checkOnline, 2000);
}

setupOnlineNotifier();