# StopNBlock - Stop and block ads upon request

While watching a YouTube ad you don't wish to watch, just click StopNBlock or press `AltGr+.` 

It stops the video, opens the Google My Ad Center and runs through the block-request procedure. 

It does nothing automatically, only on your initiative and serves as a one-click accessibility shortcut for Google's My Ad Center on YouTube, helping users quickly access and submit feedback on ads that seem offensive or disturbing. 

The need for access permission to `youtube`, `myadcenter`, and to `adsettings` is solely for that purpose. No information is recovered stored or changed by this add-on app. 

## Download and install

There is no Chrome Web Store release yet on the Chrome and App stores. 

For testing [Download the repository as a ZIP](https://github.com/pashute/StopNBlock/archive/refs/heads/main.zip) and extract it. In Chrome, open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the extracted `StopNBlock-main` folder. Pin StopNBlock to the toolbar if desired.

Note: Chrome shortcuts can be changed at `chrome://extensions/shortcuts`.

The extension depends on YouTube and My Ad Center's interface and English button labels. It may not work for every ad, account, language, or future interface change. An `ERR` badge indicates that the operation failed; details are logged in the extension's service worker or the page's developer console. If it fails after pausing the video, close any open dialog and resume playback manually.

## License and contact

This software is provided as open source with UnLicense: A public-domain-like software license dedicating code to the public domain with zero restrictions, no warranty, and full freedom to copy, modify, and distribute. See [LICENSE](LICENSE).

For any questions you may contact the developer pashute@gmail.com.
