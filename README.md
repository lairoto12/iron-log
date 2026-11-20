# Iron Log

A private gym app for your phone: weekly split with set tracking, calorie and macro log, photo food estimates, a body-stats calorie calculator, weight trend, and an AI coach — all running **on the phone**. No accounts, no API keys. Your data never leaves the device.

- **Coach:** Qwen 2.5 (3B or 1.5B) via [WebLLM](https://github.com/mlc-ai/web-llm), on the phone's GPU.
- **Photo estimates:** SmolVLM (500M or 256M) via [Transformers.js](https://github.com/huggingface/transformers.js) spots the food, then the coach works out calories and macros.
- Models download once from public Hugging Face files (no login), then work offline.

## Files

| File | What it is |
|---|---|
| `index.html` | The app screen and styles |
| `app.js` | Everything you see and tap; data saved on the phone |
| `ai.js` | Loads and runs the on-phone AI models |
| `sw.js` | Lets the app open without internet |
| `manifest.webmanifest`, `icons/` | Name and icon for installing it |

## Put it online with GitHub Pages (free, about 5 minutes)

1. Sign in at github.com (create a free account if you don't have one).
2. Click **+** (top right) → **New repository**. Name it `iron-log`, set it to **Public**, click **Create repository**.
3. On the new repo page, click **uploading an existing file**.
4. Drag in **everything inside the `iron-log-app` folder** (the files *and* the `icons` folder), not the folder itself. Click **Commit changes**.
5. Go to **Settings → Pages**. Under *Branch*, pick **main** and **/ (root)**, then **Save**.
6. Wait a minute, refresh that page, and you'll see your link: `https://YOUR-NAME.github.io/iron-log/`

The code is public; your workouts, food, photos and chats are not — they stay on your phone.

## Install on your Pixel

1. Open your link in **Chrome** on the phone.
2. Tap **⋮ → Install app** (or **Add to Home screen → Install**).
3. Open Iron Log from the home screen. It runs full screen like any other app.
4. Go to **Coach → Download and start coach** on Wi-Fi (about 2 GB the first time). The photo model (about 0.5 GB) downloads the first time you estimate a photo.

If the phone gets hot or runs out of memory, pick the smaller models under **Settings** (gear icon).

## Want an actual APK file?

1. Go to **pwabuilder.com** and paste your GitHub Pages link.
2. Click **Package for stores → Android → Generate**, and download the zip.
3. Copy the `.apk` from the zip to your phone and open it. Allow "Install unknown apps" for your file manager when asked.

The APK opens the same web app full screen, so it still needs to be online the first time to load. Most people are fine with Chrome's **Install app**, which gives the same result.

## Back up your data

Data lives only in the app on your phone. Use **Settings → Save backup file** every so often, and **Restore backup** to bring it back on a new phone or after clearing Chrome's data.

## Updating the app

Upload changed files to the same GitHub repo. The installed app picks up the new version the next time it's opened online.
