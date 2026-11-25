# StopNBlock - Stop and block ads upon request

While watching a YouTube ad that you wish to avoid, just click StopNBlock or press `AltGr+.` 

It stops the video, opens the Google My Ad Center and runs through the block-request procedure. 

- It does nothing automatically, only on your initiative during a running ad.
- It serves as a one-click accessibility shortcut for Google's My Ad Center on YouTube, helping users quickly access and submit feedback on ads that seem offensive or disturbing.
- It is totally open source. See the [StopNBlock repo on github](https://github.com/pashute/StopNBlock).
- It is distributed with UnLicense - to the public domain, with no warranty but also no restrictions to use copy or modify. See the [UnLicense](docs/UnLicense) document.
- For any questions contact [the developer (@pashute)](mailto:pashute@gmail.com)


## Download and install

There is no Chrome Web Store release yet on the Chrome and App stores. 

For testing [Download the repository as a ZIP](https://github.com/pashute/StopNBlock/archive/refs/heads/main.zip) and extract it. In Chrome, open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the extracted `StopNBlock-main` folder. Pin StopNBlock to the toolbar if desired.

Note: Chrome shortcuts can be changed at `chrome://extensions/shortcuts`.


### Access Permissions

The need for access permission to `youtube`, `myadcenter`, and to `adsettings` is solely for interacting with ad center according to the user's request, while following Google's restrictions. No information is recovered stored or changed by this add-on app. No advertisements are bypassed or any other action other than requesting the Google Ad Center interface upon the user's request. 


## Developer notes:

- See [Developer Notes](docs/developer.md) to understand how the program works, and its features. 
- See the [UnLicense](docs/UnLicense.md) document for this app's unrestrictive license donated to the common domain.




