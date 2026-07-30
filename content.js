let settings = {
    status: true,
    typing: false,
    blueTicks: false,
    audio: false
};

function updateSettings() {
    chrome.storage.local.get(['status', 'typing', 'blueTicks', 'audio'], (result) => {
        Object.assign(settings, result);
        const btn = document.getElementById('btn-download-status-native');
        if (!settings.status && btn) {
            btn.remove();
        }
    });
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

const script = document.createElement('script');
script.textContent = `(${hookWhatsAppWebSocket.toString()})();`;
(document.head || document.documentElement).appendChild(script);
script.remove();

chrome.storage.onChanged.addListener(() => {
    updateSettings();
});

const observer = new MutationObserver(() => {
    injectNativeButton();
});

observer.observe(document.body, { childList: true, subtree: true });
updateSettings();

function disableLeavePrompt() {
    window.onbeforeunload = null;
    window.addEventListener('beforeunload', (e) => {
        e.stopImmediatePropagation();
    }, true);
}

const scriptPrompt = document.createElement('script');
scriptPrompt.textContent = `(${disableLeavePrompt.toString()})();`;
(document.head || document.documentElement).appendChild(scriptPrompt);
scriptPrompt.remove();
