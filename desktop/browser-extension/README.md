# ATIRA Browser Activity

This Manifest V3 extension records only the hostname of the active tab while a normal browser window is focused and the computer has not been away for five minutes. It excludes incognito windows, local pages, URL paths, query strings, titles, content, searches, and keystrokes.

For Chromium development, open the browser's extensions page, enable Developer mode, choose **Load unpacked**, and select this folder. Run `npm run desktop:browser:build` at the repository root to generate separate Chromium and Firefox packages. In the installed ATIRA app, open **You → Browser activity**, create a five-minute connection code, then enter it in the extension popup.

The extension queues completed intervals locally when ATIRA is closed and uploads them only to the authenticated companion on `127.0.0.1`.
