const { APP_NAME, APP_VERSION, log } = globalThis.logger; // loaded by popup.html before this file

const PERMISSION = { permissions: ["storage"] };

const versionEl = document.getElementById("version");
const shortcutEl = document.getElementById("shortcut");
const startButton = document.getElementById("start");
const statusEl = document.getElementById("status");
const setKeyButton = document.getElementById("setKey");
const keyForm = document.getElementById("keyForm");
const keyInput = document.getElementById("keyInput");
const saveKeyButton = document.getElementById("saveKey");
const keyStatusEl = document.getElementById("keyStatus");
const storeToggle = document.getElementById("storeToggle");
const listEl = document.getElementById("list");

function setStatus(text) {
  statusEl.textContent = text;
}

versionEl.textContent = `v${APP_VERSION}`;
// log("DEBUG", `[popup] ${APP_NAME} v${APP_VERSION} opened`);

async function showShortcut() {
  const commands = await chrome.commands.getAll();
  const shortcut = commands.find((command) => command.name === "trigger-stop-block")?.shortcut;
  shortcutEl.innerHTML = shortcut
    ? `or press <kbd>${shortcut}</kbd> on a disturbing ad.`
    : `No shortcut set. Set one at chrome://extensions/shortcuts`;
}

// Storage is requested only when the user saves a key or ticks the checkbox.
async function ensureStorage() {
  if (await chrome.permissions.contains(PERMISSION)) return true;
  return chrome.permissions.request(PERMISSION);
}

function renderList(names) {
  listEl.innerHTML = "";
  for (const name of names) {
    const item = document.createElement("li");
    item.textContent = name;
    listEl.appendChild(item);
  }
}

async function refresh() {
  if (!(await chrome.permissions.contains(PERMISSION))) {
    keyStatusEl.textContent = "No key saved. Summaries are skipped.";
    storeToggle.checked = false;
    renderList([]);
    return;
  }
  const { geminiKey, storeAdvertisers, advertiserList = [] } =
    await chrome.storage.local.get(["geminiKey", "storeAdvertisers", "advertiserList"]);
  keyStatusEl.textContent = geminiKey
    ? "Key saved on this computer only. It is not shared with anyone."
    : "No key saved. Summaries are skipped.";
  storeToggle.checked = Boolean(storeAdvertisers);
  renderList(advertiserList);
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
    // log("DEBUG", `[popup] start pressed on tab ${tab.id}`);
    await chrome.runtime.sendMessage({ source: "stopnblock", type: "start", tabId: tab.id });
    setStatus("Started. Check the YouTube tab's console (F12) for progress.");
  } catch (error) {
    setStatus(`Could not start: ${error.message}`);
  } finally {
    startButton.disabled = false;
  }
});

setKeyButton.addEventListener("click", () => {
  keyForm.hidden = !keyForm.hidden;
  if (!keyForm.hidden) keyInput.focus();
});

saveKeyButton.addEventListener("click", async () => {
  const key = keyInput.value.trim();
  if (!key) return;
  if (!(await ensureStorage())) {
    keyStatusEl.textContent = "Storage permission was refused, so the key was not saved.";
    return;
  }
  await chrome.storage.local.set({ geminiKey: key });
  keyInput.value = "";
  keyForm.hidden = true;
  await refresh();
});

storeToggle.addEventListener("change", async () => {
  if (storeToggle.checked && !(await ensureStorage())) {
    storeToggle.checked = false;
    return;
  }
  if (await chrome.permissions.contains(PERMISSION)) {
    await chrome.storage.local.set({ storeAdvertisers: storeToggle.checked });
  }
  await refresh();
});

void showShortcut().catch((error) => setStatus(`Error: ${error.message}`));
void refresh().catch((error) => setStatus(`Error: ${error.message}`));
