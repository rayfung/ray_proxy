// vim: set sw=2 ts=2 softtabstop=2 expandtab :

let bypassHosts = ["localhost", "[::1]"];
let proxyHost = "127.0.0.1";
let proxyPort = 0;
let proxyId = 0;

browser.storage.local.get(data => {
  if (typeof data.proxyHost !== 'undefined') {
    proxyHost = data.proxyHost;
  }

  if (typeof data.proxyPort !== 'undefined') {
    proxyPort = data.proxyPort;
  }
});

browser.storage.onChanged.addListener(changeData => {
  if (changeData.proxyHost) {
    proxyHost = changeData.proxyHost.newValue;
  }

  if (changeData.proxyPort) {
    proxyPort = changeData.proxyPort.newValue;
  }
});

// Managed the proxy

// Listen for a request to open a webpage
browser.proxy.onRequest.addListener(handleProxyRequest, {urls: ["<all_urls>"]});

// On the request to open a webpage
function handleProxyRequest(requestInfo) {
  if (proxyId == 0) {
    return {type: "direct"};
  }
  else {
    const url = new URL(requestInfo.url);
    if (url.hostname.startsWith("127.") || bypassHosts.indexOf(url.hostname) != -1) {
      return {type: "direct"};
    }

    return {type: "socks", host: proxyHost, port: proxyPort, proxyDNS: true};
  }
}

// Log any errors from the proxy script
browser.proxy.onError.addListener(error => {
  console.error(`Proxy error: ${error.message}`);
});

function updateIcon() {
  if (proxyId == 0) {
    browser.browserAction.setIcon({path: "icons/direct.png"});
    //browser.browserAction.setBadgeText({text: "0"});
    //browser.browserAction.setBadgeBackgroundColor({'color': 'yellow'});
  }
  else {
    browser.browserAction.setIcon({path: "icons/main.png"});
    //browser.browserAction.setBadgeText({text: "1"});
    //browser.browserAction.setBadgeBackgroundColor({'color': 'green'});
  }
}

function handleMessage(msg) {
  switch (msg.command) {
    case "direct":
      proxyId = 0;
      break;

    case "proxy":
      proxyId = 1;
      break;
  }

  updateIcon();
}

updateIcon();
browser.runtime.onMessage.addListener(handleMessage);

