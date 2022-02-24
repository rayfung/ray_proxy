// vim: set sw=2 ts=2 softtabstop=2 expandtab :

const proxyHostInput = document.querySelector("#proxy-host");
const proxyPortInput = document.querySelector("#proxy-port");
const proxySaveButton = document.querySelector("#proxy-save");
const proxyReloadButton = document.querySelector("#proxy-reload");

function updateUI(settings) {
  proxyHostInput.value = settings.proxyHost === undefined ? "" : settings.proxyHost;
  proxyPortInput.value = settings.proxyPort === undefined ? "" : settings.proxyPort;
}

function saveSettings() {
  browser.storage.local.set({
    proxyHost: proxyHostInput.value,
    proxyPort: parseInt(proxyPortInput.value)
  });
}

browser.storage.local.get().then(updateUI);

proxySaveButton.addEventListener("click", (e) => {
  saveSettings();
});

proxyReloadButton.addEventListener("click", (e) => {
  browser.storage.local.get().then(updateUI);
});
