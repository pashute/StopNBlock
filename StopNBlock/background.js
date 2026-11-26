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

chrome.runtime.onMessage.addListener((message, sender) => {
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
