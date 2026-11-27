importScripts("logger.js"); // provides APP_NAME, APP_VERSION, log() and logError() (see logger.js)
const { APP_NAME, APP_VERSION, log, logError } = globalThis.logger;
const running = new Map();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function setBadge(tabId, text) {
  await chrome.action.setBadgeText({ tabId, text });
  if (text) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#b3261e" });
  }
}

async function trigger(tab, source) {
  if (!tab?.id || !tab.url) return;
  // log("DEBUG", `[trigger] ${APP_NAME} v${APP_VERSION} triggered by ${source} on tab ${tab.id}`);

  const hostname = new URL(tab.url).hostname.toLowerCase();
  if (hostname !== "youtube.com" && !hostname.endsWith(".youtube.com")) {
    log("ERROR", "the active tab is not YouTube.");
    await setBadge(tab.id, "ERR");
    return;
  }
  if (running.has(tab.id)) return;

  const run = { finished: false, error: null };
  running.set(tab.id, run);
  try {
    await setBadge(tab.id, "");
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: (source) => {
        globalThis.__stopNBlockStarted = false;
        globalThis.__stopNBlockSource = source;
      },
      args: [source]
    });

    const deadline = Date.now() + 100000;
    while (!run.finished && Date.now() < deadline) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["logger.js", "content.js"]
      });
      if (!run.finished) await delay(500);
    }
    if (!run.finished) throw new Error("Timed out waiting for the ad-blocking flow.");
    if (run.error) throw new Error(run.error);
  } catch (error) {
    logError("the ad-blocking flow failed", error);
    await setBadge(tab.id, "ERR");
  } finally {
    running.delete(tab.id);
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command !== "trigger-stop-block") return;
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await trigger(tab, "keyboard shortcut");
  })().catch((error) => logError("the keyboard shortcut failed", error));
});

const GEMINI_MODEL = "gemini-2.5-flash";
const SUMMARY_TIMEOUT_MS = 4000;
const LIST_SIZE = 10;

// Storage is an optional permission: it is only ever requested from the popup.
async function hasStorage() {
  return chrome.permissions.contains({ permissions: ["storage"] });
}

// Two-to-five-word headline of what the advertiser advertises. Returns null when there is no key.
async function summarize(advertiser) {
  if (!(await hasStorage())) return { summary: null };
  const { geminiKey } = await chrome.storage.local.get("geminiKey");
  if (!geminiKey) return { summary: null };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "What is this advertiser advertising? Reply with a telegraphic headline of 2 to 5 words and nothing else. " +
                `Advertiser: ${advertiser}`
            }]
          }]
        }),
        signal: controller.signal
      }
    );
    if (!response.ok) return { summary: null, error: `Gemini answered HTTP ${response.status}` };
    const data = await response.json();
    return { summary: data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null };
  } catch (error) {
    return { summary: null, error: error.name === "AbortError" ? "no answer within 4 seconds" : error.message };
  } finally {
    clearTimeout(timer);
  }
}

// Keeps the last 10 blocked advertisers, newest first, only when "Store in list" is on.
async function remember(details) {
  if (!(await hasStorage())) return;
  const { storeAdvertisers, advertiserList = [] } =
    await chrome.storage.local.get(["storeAdvertisers", "advertiserList"]);
  if (!storeAdvertisers) return;
  const entry = {
    name: details.advertiser,
    location: details.location ?? null,
    summary: details.summary ?? null,
    time: new Date().toISOString()
  };
  const list = [entry, ...advertiserList.filter((item) => (item.name ?? item) !== entry.name)].slice(0, LIST_SIZE);
  await chrome.storage.local.set({ advertiserList: list });
}

// What the user has switched on. Storage is "Not-needed" when neither the key nor the list is on.
async function settingsState() {
  const granted = await hasStorage();
  const stored = granted ? await chrome.storage.local.get(["geminiKey", "storeAdvertisers"]) : {};
  const aiKey = Boolean(stored.geminiKey);
  const storedList = Boolean(stored.storeAdvertisers);
  const permission = !aiKey && !storedList ? "Not-needed" : granted ? "Yes" : "No";
  return { aiKey, storedList, permission };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.source === "stopnblock" && message.type === "state") {
    void settingsState()
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  }
  if (message?.source === "stopnblock" && message.type === "summarize") {
    void summarize(message.advertiser)
      .then(sendResponse)
      .catch((error) => sendResponse({ summary: null, error: error.message }));
    return true; // keep the channel open for the async reply
  }
  if (message?.source === "stopnblock" && message.type === "remember") {
    void remember(message.details)
      .catch((error) => logError("could not save the advertiser name", error))
      .finally(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.source === "stopnblock" && message.type === "start") {
    // Sent by the popup's Start button.
    void chrome.tabs.get(message.tabId)
      .then((tab) => trigger(tab, "popup button"))
      .catch((error) => logError("the popup Start button failed", error));
    return;
  }
  const tabId = sender.tab?.id;
  const run = running.get(tabId);
  if (!run || message?.source !== "stopnblock") return;

  if (message.type === "ad-center-result" && sender.frameId !== 0) {
    chrome.tabs.sendMessage(tabId, message, { frameId: 0 }).catch((error) => {
      logError("could not notify the YouTube page", error);
    });
  } else if (message.type === "finished" && sender.frameId === 0) {
    run.error = message.error || null;
    run.finished = true;
  }
});
