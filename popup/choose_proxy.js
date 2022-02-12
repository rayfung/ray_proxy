// vim: set sw=2 ts=2 softtabstop=2 expandtab :

function listenForClicks() {
  document.addEventListener("click", (e) => {

    if (e.target.classList.contains("proxy")) {
      browser.runtime.sendMessage({command: "proxy"}).then((msg) => {
        window.close();
      });
    }
    else if (e.target.classList.contains("direct")) {
      browser.runtime.sendMessage({command: "direct"}).then((msg) => {
        window.close();
      });
    }
    else if (e.target.classList.contains("option")) {
      browser.runtime.openOptionsPage().then(() => { window.close(); });
    }

  });
}

listenForClicks();
