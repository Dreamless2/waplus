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

// Nova função auxiliar para confirmar se o usuário realmente está visualizando um Status
function isLookingAtStatus() {
    // Verifica se a URL do WhatsApp Web aponta para a seção de status
    if (window.location.hash.includes('/status')) return true;

    // Validação secundária por elementos do DOM exclusivos da tela de status do WA Web
    const statusContainer = document.querySelector('div[style*="background-color: var(--status-background)"]') ||
        document.querySelector('.x1n2onr6.x1vjfegm.x193iq5w'); // Classes comuns do contêiner de status

    return !!statusContainer;
}

function injectNativeButton() {
    if (!settings.status) return;
    if (document.getElementById('btn-download-status-native')) return;

    // 1. Bloqueia a inserção se NÃO estiver na tela de Status
    if (!isLookingAtStatus()) return;

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

        // Busca a mídia limitando o escopo ao contêiner de exibição do status ativo
        const activeStatusArea = closeButtonContainer.closest('.x1vjfegm') || document;
        const video = activeStatusArea.querySelector('video');
        const img = activeStatusArea.querySelector('img[src^="blob:"]') || activeStatusArea.querySelector('img');

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
            alert('Erro: Mídia do Status não encontrada!');
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