// vim: set sw=2 ts=2 softtabstop=2 expandtab :

let bypassHosts = ["localhost", "[::1]"];
let proxyHost = "127.0.0.1";
let proxyPort = 0;

let globalProxyId = 0;
let windowProxyId = {};

initProxy();


async function initProxy() {
  // First of all, listen for proxy settings changes
  browser.storage.onChanged.addListener(changeData => {
    if (changeData.proxyHost) {
      proxyHost = changeData.proxyHost.newValue;
    }

    if (changeData.proxyPort) {
      proxyPort = changeData.proxyPort.newValue;
    }
  });

  // Then get initial proxy settings
  const initialConfig = await browser.storage.local.get();

  if (typeof initialConfig.proxyHost !== 'undefined') {
    proxyHost = initialConfig.proxyHost;
  }

  if (typeof initialConfig.proxyPort !== 'undefined') {
    proxyPort = initialConfig.proxyPort;
  }

  // All data are ready, it is time to listen for a request to open a webpage
  browser.proxy.onRequest.addListener(handleProxyRequest, { urls: ["<all_urls>"] });

  // Finally, enable browser action functionality
  await updateIcon();
  browser.runtime.onMessage.addListener(handleMessage);
}

// On the request to open a webpage
async function handleProxyRequest(requestInfo) {
  if (isWindowProxyEmpty() || requestInfo.tabId == -1) {
    // Use global config
    return getProxyById(globalProxyId, requestInfo);
  }

  try {
    // Try getting window specific config
    let tabInfo = await browser.tabs.get(requestInfo.tabId);
    return getProxyById(getWindowFinalProxyId(tabInfo.windowId), requestInfo);
  } catch {
    // Block request in case of error
    console.error("Ray Proxy: Failed to get window specific proxy.\nRequest blocked: " + requestInfo.url);
    return getBlockedProxy();
  }
}

function isWindowProxyEmpty() {
  for (var x in windowProxyId) { return false; }
  return true;
}

function getWindowFinalProxyId(windowId) {
  let proxyId = windowProxyId[windowId];
  return proxyId === undefined ? globalProxyId : proxyId;
}

function getProxyById(proxyId, requestInfo) {
  if (proxyId == 0) {
    return { type: "direct" };
  }
  else {
    const url = new URL(requestInfo.url);
    if (url.hostname.startsWith("127.") || bypassHosts.indexOf(url.hostname) != -1) {
      return { type: "direct" };
    }

    return { type: "socks", host: proxyHost, port: proxyPort, proxyDNS: true };
  }
}

function getBlockedProxy() {
  return { type: "socks", host: "127.0.0.1", port: 65535, proxyDNS: true };
}

// Log any errors from the proxy script
browser.proxy.onError.addListener(error => {
  console.error(`Proxy error: ${error.message}`);
});

async function updateIcon() {
  browser.browserAction.setIcon({ path: getProxyIconPath(globalProxyId) });

  let winInfos = await browser.windows.getAll();
  for (var info of winInfos) {
    let proxyId = getWindowFinalProxyId(info.id);
    browser.browserAction.setIcon({ path: getProxyIconPath(proxyId), windowId: info.id });
  }
}

function getProxyIconPath(proxyId) {
  return proxyId == 0 ? "icons/direct.png" : "icons/main.png";
}

function getProxyState(windowId) {
  const wpid = windowProxyId[windowId];
  return Promise.resolve({ global: globalProxyId, window: wpid });
}

function handleMessage(msg) {
  switch (msg.command) {
    case "global_direct":
      globalProxyId = 0;
      windowProxyId = {};
      break;

    case "global_proxy":
      globalProxyId = 1;
      windowProxyId = {};
      break;

    case "window_direct":
      windowProxyId[msg.windowId] = 0;
      break;

    case "window_proxy":
      windowProxyId[msg.windowId] = 1;
      break;

    case "get_proxy_state":
      return getProxyState(msg.windowId);

    case "log_proxy":
      console.log("Global proxy: %d\nWindow proxy: %o", globalProxyId,
        JSON.parse(JSON.stringify(windowProxyId)));
      return;
  }

  updateIcon();
}
