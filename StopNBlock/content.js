(() => {
  // logger.js is injected before this file and provides log().
  const { APP_NAME, APP_VERSION, log, logError } = globalThis.logger;

  if (globalThis.__stopNBlockStarted) return;
  globalThis.__stopNBlockStarted = true;

  const triggerSource = globalThis.__stopNBlockSource || "unknown";
  const frameKind = window === window.top ? "top frame" : "sub-frame";
  log("VERSION", `[step0] ${APP_NAME} v${APP_VERSION} started (trigger: ${triggerSource}, ${frameKind}) at ${location.href}`);

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const visible = (element) => element && element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden";

  function describe(element) {
    if (!element) return null;
    return {
      tag: element.tagName,
      text: (element.textContent || "").trim().slice(0, 80),
      html: element.outerHTML.slice(0, 300)
    };
  }

  // Collects every element, including inside open shadow roots.
  function allElements(root = document, found = []) {
    for (const element of root.querySelectorAll("*")) {
      found.push(element);
      if (element.shadowRoot) allElements(element.shadowRoot, found);
    }
    return found;
  }

  function dumpButtons(step) {
    const buttons = allElements().filter((element) =>
      element.matches('button, [role="button"], input[type="button"], a')
    );
    const shown = buttons.filter(visible).slice(0, 40).map((button) =>
      (button.textContent || button.value || button.getAttribute("aria-label") || "").trim().slice(0, 40) ||
      `(no text) ${button.outerHTML.slice(0, 120)}`
    );
    // log("DEBUG", `[${step}] DEBUG: ${buttons.length} button-like elements, ${shown.length} visible:`, shown);
  }

  function dumpMatches(step, pattern) {
    const matches = allElements().filter((element) =>
      pattern.test(element.getAttribute("aria-label") || "") ||
      (element.childElementCount === 0 && pattern.test(element.textContent || ""))
    );
    // log("DEBUG", `[${step}] DEBUG: ${matches.length} element(s) matching ${pattern}`);
    matches.slice(0, 15).forEach((element) => {
      log("DEBUG", `[${step}] DEBUG match`, {
        visible: visible(element),
        ...describe(element),
        ariaLabel: element.getAttribute("aria-label"),
        clickableAncestor: element.closest('button, [role="button"], a')?.outerHTML.slice(0, 300) ?? null
      });
    });
  }

  // Visible ad text on the YouTube page (advertiser, ad message, button text).
  function adText() {
    return [...document.querySelectorAll(
      ".ytp-ad-text, .ytp-ad-preview-text, .ytp-ad-message-container, .ytp-ad-simple-ad-badge, .ytp-ad-button-text, .ytp-ad-visit-advertiser-button"
    )].filter(visible).map((element) => element.textContent.trim()).filter(Boolean);
  }

  // Start of the visible text of the About this ad / Ad Center frame.
  function pageSummary() {
    return (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 300);
  }

  function dumpIframes(step) {
    const frames = [...document.querySelectorAll("iframe")].map((frame) => ({
      src: frame.src, visible: visible(frame)
    }));
    // log("DEBUG", `[${step}] DEBUG: iframes on page:`, frames);
  }

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
      visible(frame) && /youtube\.com\/aboutthisad/i.test(frame.src)
    );
  }

  async function onYouTube() {
    if (window !== window.top) return;
    let result;
    let step = "step1";
    const onMessage = (message) => {
      if (message?.source === "stopnblock" && message.type === "ad-center-result") {
        // log("DEBUG", `[step2] result received from Ad Center frame`, message.error ? `ERROR: ${message.error}` : "OK");
        result = message;
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);

    try {
      // log("DEBUG", "[step1] looking for a visible video");
      const video = await waitForElement(
        () => {
          const videos = [...document.querySelectorAll("video")].filter(visible);
          return videos.find((candidate) => !candidate.paused) ||
            videos.find((candidate) => candidate.classList.contains("html5-main-video")) ||
            videos[0];
        },
        "a visible video"
      );
      // log("DEBUG", "[step1] video found, pausing", { paused: video.paused, currentTime: video.currentTime });
      video.pause();

      step = "step2";
      // log("DEBUG", "[step2] looking for the ad information button");
      const info = await waitForElement(
        () => [...document.querySelectorAll(
          '.ytp-ad-button-icon, [aria-label*="My Ad Center" i], [aria-label*="Why this ad" i]'
        )].find(visible),
        "the ad information button"
      );
      // log("VERSION", `[step2] ad text on page: ${JSON.stringify(adText())}`);
      // log("DEBUG", "[step2] clicking ad information button", describe(info));
      (info.closest('button, [role="button"]') || info).click();

      await waitForElement(() => adCenterFrame() || result, "My Ad Center");
      // log("DEBUG", "[step2] Ad Center frame seen", { src: adCenterFrame()?.src ?? null });

      step = "step3";
      // log("DEBUG", "[step3] waiting for Ad Center to report back (steps 3-7 run inside its frame)");
      await waitForElement(() => result, "the Ad Center confirmation", 50000);
      if (result.error) throw new Error(result.error);

      step = "step7";
      await waitForElement(() => !adCenterFrame(), "the Ad Center to close", 10000);
      // log("DEBUG", "[step7] Ad Center frame closed");

      await delay(2000);
      step = "step8";
      const adStillPlaying = [...document.querySelectorAll(
        '.ytp-ad-button-icon, [aria-label*="My Ad Center" i], [aria-label*="Why this ad" i]'
      )].some(visible);
      // log("DEBUG", "[step8] ad info button still visible after 2s?", adStillPlaying);
      if (adStillPlaying) {
        // Leave the video paused; the catch block reports the failure.
        throw new Error("The ad is still playing, so the video was not resumed.");
      }

      step = "step7";
      const continueButton = findByText(["Continue", "Return to video"]);
      // log("DEBUG", "[step7] top-level Continue/Return to video button present?", !!continueButton);
      if (continueButton) continueButton.click();
      await video.play();
      // log("DEBUG", "[step7] video resumed, flow finished");
      await chrome.runtime.sendMessage({ source: "stopnblock", type: "finished" });
    } catch (error) {
      // dumpIframes(step);
      // dumpButtons(step);
      logError(`[${step}] the ad flow failed`, error);
      await chrome.runtime.sendMessage({
        source: "stopnblock", type: "finished", error: error.message
      });
    } finally {
      chrome.runtime.onMessage.removeListener(onMessage);
    }
  }

  async function onAdCenter() {
    let step = "step3";
    // log("DEBUG", `[step3] Ad Center frame script running at ${location.href}`);
    try {
      // log("DEBUG", "[step3] looking for the Block button");
      const block = await waitForElement(() => findByText(["Block ad", "Block"]), "Block ad");
      log("VERSION", `[step3] Block called. Ad details: ${JSON.stringify(pageSummary())}`);
      // log("DEBUG", "[step3] Block button found, clicking", describe(block));
      block.click();

      step = "step4";
      // log("DEBUG", "[step4] waiting for the 'Stop seeing this ad?' Continue button");
      const continueButton = await waitForElement(() => findByText(["Continue"]), "Continue");
      // log("DEBUG", "[step4] Continue found", describe(continueButton));

      step = "step5";
      continueButton.click();
      // log("DEBUG", "[step5] Continue clicked");
      await delay(2000);

      step = "step6";
      // log("DEBUG", "[step6] after 2s, Continue still present?", !!findByText(["Continue"]));

      step = "step7";
      const close = await waitForElement(() => [...document.querySelectorAll(
        'button[aria-label*="Close" i], [role="button"][aria-label*="Close" i]'
      )].find(visible), "the Ad Center close (X) button");
      // log("DEBUG", "[step7] close (X) button found", describe(close));
      await chrome.runtime.sendMessage({ source: "stopnblock", type: "ad-center-result" });
      // log("DEBUG", "[step7] result sent to YouTube page, clicking X");
      close.click();
      // log("DEBUG", "[step7] done");
    } catch (error) {
      if (step === "step3") dumpMatches(step, /block/i);
      // dumpButtons(step);
      logError(`[${step}] the Ad Center steps failed`, error);
      await chrome.runtime.sendMessage({
        source: "stopnblock", type: "ad-center-result", error: error.message
      });
    }
  }

  // Block (and later Close) run ONLY inside the About this ad / Ad Center iframe.
  const isAdCenterFrame = window !== window.top && /\/aboutthisad/i.test(location.pathname);
  const hostname = location.hostname.toLowerCase();
  if (isAdCenterFrame) {
    void onAdCenter();
  } else if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
    void onYouTube();
  }
})();
