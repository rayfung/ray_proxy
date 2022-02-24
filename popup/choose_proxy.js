// vim: set sw=2 ts=2 softtabstop=2 expandtab :

const cboxGlobal = document.querySelector("#cbox_global");
const cboxWindow = document.querySelector("#cbox_window");
const btnOption = document.querySelector("#btn_option");

listenForClicks();
updateMenuItems();


async function onChangeGlobalProxy() {
  await browser.runtime.sendMessage({ command: cboxGlobal.checked ? "global_proxy" : "global_direct" });
  await updateMenuItems();
}

async function onChangeWindowProxy() {
  let winInfo = await browser.windows.getCurrent();
  const windowId = winInfo.id;
  await browser.runtime.sendMessage({ command: cboxWindow.checked ? "window_proxy" : "window_direct", windowId: windowId });
  await updateMenuItems(windowId);
}

async function processOptionClick() {
  await browser.runtime.openOptionsPage();
  window.close();
}

function listenForClicks() {
  cboxGlobal.addEventListener("change", onChangeGlobalProxy);
  cboxWindow.addEventListener("change", onChangeWindowProxy);
  btnOption.addEventListener("click", processOptionClick);
}

async function updateMenuItems(windowId) {
  if (windowId === undefined) {
    let winInfo = await browser.windows.getCurrent();
    windowId = winInfo.id;
  }

  let proxyState = await browser.runtime.sendMessage({ command: "get_proxy_state", windowId: windowId });
  const globalState = (proxyState.global != 0);

  cboxGlobal.checked = globalState;
  cboxWindow.checked = proxyState.window === undefined ? globalState : (proxyState.window != 0);
}
