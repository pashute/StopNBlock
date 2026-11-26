const { debugLog } = globalThis.StopNBlockLog; // loaded by popup.html before this file

const APP_NAME = "StopNBlock";
const APP_VERSION = "1.0.2";

const versionEl = document.getElementById("version");
const shortcutEl = document.getElementById("shortcut");
const startButton = document.getElementById("start");
const statusEl = document.getElementById("status");

function setStatus(text) {
  statusEl.textContent = text;
}

versionEl.textContent = `v${APP_VERSION}`;
debugLog(`[popup] ${APP_NAME} v${APP_VERSION} opened`);

async function showShortcut() {
  const commands = await chrome.commands.getAll();
  const shortcut = commands.find((command) => command.name === "trigger-stop-block")?.shortcut;
  shortcutEl.innerHTML = shortcut
    ? `Shortcut: <kbd>${shortcut}</kbd>`
    : `Shortcut: not set (set it at chrome://extensions/shortcuts)`;
}

startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  setStatus("Starting...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus("No active tab found.");
      return;
    }
    debugLog(`[popup] start pressed on tab ${tab.id}`);
    await chrome.runtime.sendMessage({ source: "stopnblock", type: "start", tabId: tab.id });
    setStatus("Started. Check the YouTube tab's console (F12) for progress.");
  } catch (error) {
    setStatus(`Could not start: ${error.message}`);
  } finally {
    startButton.disabled = false;
  }
});

void showShortcut().catch((error) => setStatus(`Error: ${error.message}`));
