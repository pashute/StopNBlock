const running = new Map();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function setBadge(tabId, text) {
  await chrome.action.setBadgeText({ tabId, text });
  if (text) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#b3261e" });
  }
}

async function trigger(tab) {
  if (!tab?.id || !tab.url) return;

  const hostname = new URL(tab.url).hostname.toLowerCase();
  if (hostname !== "youtube.com" && !hostname.endsWith(".youtube.com")) {
    console.error("StopNBlock: the active tab is not YouTube.");
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
      func: () => { globalThis.__stopNBlockStarted = false; }
    });

    const deadline = Date.now() + 100000;
    while (!run.finished && Date.now() < deadline) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["content.js"]
      });
      if (!run.finished) await delay(500);
    }
    if (!run.finished) throw new Error("Timed out waiting for the ad-blocking flow.");
    if (run.error) throw new Error(run.error);
  } catch (error) {
    console.error("StopNBlock:", error);
    await setBadge(tab.id, "ERR");
  } finally {
    running.delete(tab.id);
  }
}

chrome.action.onClicked.addListener((tab) => {
  void trigger(tab).catch((error) => console.error("StopNBlock:", error));
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "trigger-stop-block") return;
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await trigger(tab);
  })().catch((error) => console.error("StopNBlock:", error));
});

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id;
  const run = running.get(tabId);
  if (!run || message?.source !== "stopnblock") return;

  if (message.type === "ad-center-result" && sender.frameId !== 0) {
    chrome.tabs.sendMessage(tabId, message, { frameId: 0 }).catch((error) => {
      console.error("StopNBlock: could not notify the YouTube page:", error);
    });
  } else if (message.type === "finished" && sender.frameId === 0) {
    run.error = message.error || null;
    run.finished = true;
  }
});
