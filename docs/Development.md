# Development

### development instructions

- Make everything on the main branch. 
- Commit and merge with main without testing 
- Any testing will be done manually, by the human developer. 


## Build and deploy

There are no dependencies or build step: the repository root is the unpacked Manifest V3 extension. Clone the repository and load that folder via `chrome://extensions` > **Developer mode** > **Load unpacked**. After modifying the source, click the extension's reload button there.

To distribute the unpacked source, publish a GitHub release containing a ZIP with `manifest.json`, `background.js`, `content.js`, and `LICENSE` at the archive root. The README's main-branch ZIP is also available directly from GitHub.

To publish to the Chrome Web Store, create a developer account, package the extension files in a ZIP with `manifest.json` at its root, and upload it in the Chrome Web Store Developer Dashboard. Complete the listing, permission justifications, privacy disclosures, and any required review before publishing. Update the README with the actual store URL only after publication.

The automation relies on external interfaces and English labels. A human should check the toolbar and keyboard flows with a real eligible ad after interface or permission changes. Inspect the extension service worker and the relevant frame's developer console for errors.


## Original request

### Intention
Make a chrome add-on called stopnblock that with both options of a hot key or a single mouse click stops the youtube (ad) playing, clicks on the ad center, chooses block and presses continue then closes the ad center and presses continue.

### StopNBlock repo
Create a new StopNBlock repo for me (user Pashute)
with a readme that says:
 StopNBlock - Stop and block ads upon request
 
While watching a YouTube ad you don't wish to watch, 
just click StopNBlock or press AltGr+. It finds the ad center, clicks block, continue and closes the ad center once done. 

This software is provided as open source with UnLicense: A public-domain-like software license dedicating code to the public domain with zero restrictions, no warranty, and full freedom to copy, modify, and distribute.

For any questions you may contact the developer pashute@gmail.com 


### Add-on Creation Instructions

Create a Manifest V3 Chrome extension named **StopNBlock** consisting of `manifest.json`, `background.js`, and `content.js` that automates blocking a YouTube ad via toolbar icon click or keyboard shortcut (`Ctrl+Alt+Period` / `MacCtrl+Alt+Period`, triggered by `AltGr+.` on Windows):

1. **Manifest (`manifest.json`)**:
   - Permissions: `activeTab`, `scripting`.
   - Host permissions: `*://*.youtube.com/*`, `*://adsettings.google.com/*`, `*://myadcenter.google.com/*`.
   - Configure `action` (no popup, click-triggered) and `commands` (`trigger-stop-block` with default `Ctrl+Alt+Period` and mac `MacCtrl+Alt+Period`).
   - Register `background.js` as the service worker.

2. **Background Service Worker (`background.js`)**:
   - Listen to `chrome.action.onClicked` and `chrome.commands.onCommand`.
   - Verify the active tab URL includes `youtube.com`, then inject `content.js` with `allFrames: true` so it executes in both the YouTube main page and the cross-origin My Ad Center iframe.

3. **Content Script (`content.js`)**:
   - Implement a DOM-polling helper (`waitForElement`) and case-insensitive text/aria-label button matcher (`findByText`).
   - **On `youtube.com`**:
     1. Pause the active `<video>` element.
     2. Locate and click the Ad Info / My Ad Center button (`.ytp-ad-button-icon`, `[aria-label*="My Ad Center"]`, `[aria-label*="Why this ad"]`).
     3. Poll until the Ad Center modal/iframe closes, click `"Continue"` or `"Return to video"` if present, and call `video.play()` to resume playback.
   - **Inside `myadcenter.google.com` / `adssettings.google.com` iframe**:
     1. Wait for and click `"Block ad"` or `"Block"`.
     2. Wait for and click `"Continue"`.
     3. Wait ~500ms after clicking `"Continue"`, then click the top-right `X` close icon (`button[aria-label*="Close" i], [role="button"][aria-label*="Close" i]`).


### development doc

add a development.md document in the root, with everything in this prompt including this line. 

Then add in that document a section with instructions for the developer how to build and deploy

Update the readme with user instructions where to download and how to install the add-on 


