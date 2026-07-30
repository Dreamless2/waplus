chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab.url && tab.url.includes('://whatsapp.com')) {
        chrome.scripting.registerContentScripts([{
            id: 'wa-websocket-hook',
            js: ['inject.js'],
            matches: ['*://*:/*'],
            runAt: 'document_start',
            world: 'MAIN'
        }]).catch(() => { });
    }
});
