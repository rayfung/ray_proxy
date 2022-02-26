// vim: set sw=2 ts=2 softtabstop=2 expandtab :

const gcTabCount = 64;
const gcWindowCount = 32;

let bypassHosts = ["localhost", "[::1]"];
let proxyHost = "127.0.0.1";
let proxyPort = 0;

let globalProxyId = 0;
let windowProxyId = {};
let tabWinMap = {};
let removedTabs = [];
let removedWindows = [];

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

  // Used to update tab-window mapping
  browser.tabs.onAttached.addListener(onTabAttached);
  browser.tabs.onCreated.addListener(onTabCreated);
  browser.tabs.onRemoved.addListener(onTabRemoved);
  browser.windows.onRemoved.addListener(onWindowRemoved);

  // Initialize tab-window mapping from currently open tabs
  // Be aware tabs closed during this stage may become garbage
  const allTabs = await browser.tabs.query({});
  for (const x of allTabs) {
    tabWinMap[x.id] = x.windowId;
  }

  // All data are ready, it is time to listen for a request to open a webpage
  browser.proxy.onRequest.addListener(handleProxyRequest, { urls: ["<all_urls>"] });

  // Finally, enable browser action functionality
  browser.runtime.onMessage.addListener(handleMessage);
  await updateIcon();
}

function onTabAttached(tabId, attachInfo) {
  tabWinMap[tabId] = attachInfo.newWindowId;
}

function onTabCreated(tabInfo) {
  tabWinMap[tabInfo.id] = tabInfo.windowId;
}

function onTabRemoved(tabId, removeInfo) {
  const count = removedTabs.push(tabId);
  if (count >= gcTabCount) {
    const tmp = removedTabs.splice(0, gcTabCount / 2);
    for (const x of tmp) {
      delete tabWinMap[x];
    }
  }
}

function onWindowRemoved(windowId) {
  const count = removedWindows.push(windowId);
  if (count >= gcWindowCount) {
    const tmp = removedWindows.splice(0, gcWindowCount / 2);
    for (const x of tmp) {
      delete windowProxyId[x];
    }
  }
}

async function fetchWindowIdOfTab(tabId) {
  // Be aware that tabInfo.id != tabId in some cases
  // That case is: tabInfo.id == closed_tab_id, tabId == fake_unused_tab_id
  // So we cannot save fetched result because tabId may be a fake id and it refers to a closed tab
  let tabInfo = await browser.tabs.get(tabId);
  return tabInfo.windowId;
}

// On the request to open a webpage
function handleProxyRequest(requestInfo) {
  const tabId = requestInfo.tabId;
  const urlString = requestInfo.url;

  if (isWindowProxyEmpty() || tabId == -1) {
    // Use global config
    return getProxyById(globalProxyId, urlString);
  }

  try {
    // Try getting window specific config
    let windowId = tabWinMap[tabId];
    if (windowId === undefined) {
      console.error(`Ray Proxy: Tab ${tabId} not found.\nRequest blocked: ${urlString}`);
      return getBlockedProxy();
    }
    return getProxyById(getWindowFinalProxyId(windowId), urlString);
  } catch {
    // Block request in case of error
    console.error("Ray Proxy: Failed to get window specific proxy.\nRequest blocked: " + urlString);
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

function getProxyById(proxyId, urlString) {
  if (proxyId == 0) {
    return { type: "direct" };
  }
  else {
    const url = new URL(urlString);
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
