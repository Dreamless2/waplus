const options = ['status', 'blueTicks', 'audio', 'typing'];

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(options, (result) => {
        options.forEach(opt => {
            const checkbox = document.getElementById(opt);
            if (result[opt] !== undefined) {
                checkbox.checked = result[opt];
            }
            checkbox.addEventListener('change', () => {
                chrome.storage.local.set({ [opt]: checkbox.checked });
            });
        });
    });
});
