const { APP_NAME, APP_VERSION, log } = globalThis.logger; // loaded by popup.html before this file

const PERMISSION = { permissions: ["storage"] };

const versionEl = document.getElementById("version");
const shortcutEl = document.getElementById("shortcut");
const startButton = document.getElementById("start");
const statusEl = document.getElementById("status");
const ledEl = document.getElementById("led");
const setKeyButton = document.getElementById("setKey");
const keyForm = document.getElementById("keyForm");
const keyInput = document.getElementById("keyInput");
const saveKeyButton = document.getElementById("saveKey");
const keyStatusEl = document.getElementById("keyStatus");
const storeToggle = document.getElementById("storeToggle");
const listButton = document.getElementById("listButton");
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

// Chrome only shows the permission prompt when the request is made straight from the click,
// so this is called first in each handler, with no await before it.
function askForStorage() {
  return chrome.permissions.request(PERMISSION);
}

function cell(text) {
  const td = document.createElement("td");
  td.textContent = text || "-";
  return td;
}

// Table of the last 10 blocked advertisers: name, location and summary when they were available.
function renderList(entries) {
  listEl.innerHTML = "";
  const head = document.createElement("tr");
  for (const title of ["Name", "Location", "Summary"]) {
    const th = document.createElement("th");
    th.textContent = title;
    head.appendChild(th);
  }
  listEl.appendChild(head);

  if (entries.length === 0) {
    const row = document.createElement("tr");
    const td = cell("Nothing stored yet.");
    td.colSpan = 3;
    row.appendChild(td);
    listEl.appendChild(row);
    return;
  }
  for (const entry of entries) {
    const item = typeof entry === "string" ? { name: entry } : entry; // older entries were plain names
    const row = document.createElement("tr");
    row.append(cell(item.name), cell(item.location), cell(item.summary));
    listEl.appendChild(row);
  }
}

async function refresh() {
  const granted = await chrome.permissions.contains(PERMISSION);
  const stored = granted
    ? await chrome.storage.local.get(["geminiKey", "storeAdvertisers", "advertiserList"])
    : {};
  const hasKey = Boolean(stored.geminiKey);

  ledEl.classList.toggle("on", hasKey);
  setKeyButton.textContent = hasKey ? "Change AI Key" : "Set AI Key";
  keyStatusEl.textContent = hasKey
    ? "Key saved on this computer only. It is not shared with anyone."
    : "No key saved. Summaries are skipped.";
  storeToggle.checked = granted && Boolean(stored.storeAdvertisers);
  renderList(stored.advertiserList || []);
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
  if (!(await askForStorage())) {
    keyStatusEl.textContent = "Storage permission was refused, so the key was not saved.";
    return;
  }
  await chrome.storage.local.set({ geminiKey: key });
  keyInput.value = "";
  keyForm.hidden = true;
  await refresh();
});

storeToggle.addEventListener("change", async () => {
  if (storeToggle.checked && !(await askForStorage())) {
    storeToggle.checked = false;
    return;
  }
  if (await chrome.permissions.contains(PERMISSION)) {
    await chrome.storage.local.set({ storeAdvertisers: storeToggle.checked });
  }
  await refresh();
});

listButton.addEventListener("click", async () => {
  listEl.hidden = !listEl.hidden;
  if (!listEl.hidden) await refresh();
});

void showShortcut().catch((error) => setStatus(`Error: ${error.message}`));
void refresh().catch((error) => setStatus(`Error: ${error.message}`));
