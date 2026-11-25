(() => {
  if (globalThis.__stopNBlockStarted) return;
  globalThis.__stopNBlockStarted = true;

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const visible = (element) => element && element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden";

  async function waitForElement(find, description, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const element = find();
      if (element) return element;
      await delay(200);
    }
    throw new Error(`Timed out waiting for ${description}.`);
  }

  function findByText(labels, root = document) {
    const names = labels.map((label) => label.toLowerCase());
    return [...root.querySelectorAll('button, [role="button"], input[type="button"]')]
      .find((element) => {
        const values = [element.textContent, element.getAttribute("aria-label"), element.value];
        return visible(element) && values.some((value) =>
          value && names.includes(value.trim().toLowerCase())
        );
      });
  }

  function adCenterFrame() {
    return [...document.querySelectorAll("iframe")].find((frame) =>
      visible(frame) && /(?:myadcenter|adsettings|adssettings)\.google\.com/i.test(frame.src)
    );
  }

  async function onYouTube() {
    if (window !== window.top) return;
    let result;
    const onMessage = (message) => {
      if (message?.source === "stopnblock" && message.type === "ad-center-result") {
        result = message;
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);

    try {
      const video = await waitForElement(
        () => {
          const videos = [...document.querySelectorAll("video")].filter(visible);
          return videos.find((candidate) => !candidate.paused) ||
            videos.find((candidate) => candidate.classList.contains("html5-main-video")) ||
            videos[0];
        },
        "a visible video"
      );
      video.pause();

      const info = await waitForElement(
        () => [...document.querySelectorAll(
          '.ytp-ad-button-icon, [aria-label*="My Ad Center" i], [aria-label*="Why this ad" i]'
        )].find(visible),
        "the ad information button"
      );
      (info.closest('button, [role="button"]') || info).click();

      await waitForElement(() => adCenterFrame() || result, "My Ad Center");
      await waitForElement(() => result, "the Ad Center confirmation", 50000);
      if (result.error) throw new Error(result.error);

      await waitForElement(() => !adCenterFrame(), "the Ad Center to close", 10000);

      const continueButton = findByText(["Continue", "Return to video"]);
      if (continueButton) continueButton.click();
      await video.play();
      await chrome.runtime.sendMessage({ source: "stopnblock", type: "finished" });
    } catch (error) {
      console.error("StopNBlock:", error);
      await chrome.runtime.sendMessage({
        source: "stopnblock", type: "finished", error: error.message
      });
    } finally {
      chrome.runtime.onMessage.removeListener(onMessage);
    }
  }

  async function onAdCenter() {
    try {
      const block = await waitForElement(() => findByText(["Block ad", "Block"]), "Block ad");
      block.click();
      const continueButton = await waitForElement(() => findByText(["Continue"]), "Continue");
      continueButton.click();
      await delay(500);
      const close = await waitForElement(() => [...document.querySelectorAll(
        'button[aria-label*="Close" i], [role="button"][aria-label*="Close" i]'
      )].find(visible), "the Ad Center close button");
      await chrome.runtime.sendMessage({ source: "stopnblock", type: "ad-center-result" });
      close.click();
    } catch (error) {
      console.error("StopNBlock:", error);
      await chrome.runtime.sendMessage({
        source: "stopnblock", type: "ad-center-result", error: error.message
      });
    }
  }

  const hostname = location.hostname.toLowerCase();
  if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
    void onYouTube();
  } else if (["myadcenter.google.com", "adsettings.google.com", "adssettings.google.com"].includes(hostname)) {
    void onAdCenter();
  }
})();
