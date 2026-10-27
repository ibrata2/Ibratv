# IBRATV

**YOUR WORLD. YOUR TV.** — A responsive, Arabic-first IPTV playlist web player with a dark glassmorphism interface.

## Features

- Responsive glass UI with Arabic RTL layout.
- M3U/M3U8 playlist URL input and parsing.
- Default source: `https://iptv-org.github.io/iptv/index.m3u`
- Channel search, category filters, sorting, and channel logos.
- Favorites and recently watched channels stored locally.
- HLS playback using hls.js where supported, plus native browser playback when available.
- Glass, dark, and light appearance choices.
- Local settings for playlist URL and watch history.
- No build step required; static HTML/CSS/JavaScript.

## Run locally

Because browsers may restrict requests from `file://`, serve the folder over HTTP. For example, with Python installed:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

You can also publish this static site with GitHub Pages.

## GitHub Pages deployment

1. Create a repository named `IBRATV` on GitHub.
2. Upload `index.html`, `styles.css`, `app.js`, and `icon.svg` to the repository root.
3. Open **Settings → Pages**.
4. Under build and deployment, choose **Deploy from a branch**.
5. Select the default branch (usually `main`) and folder `/ (root)`, then save.
6. Wait for GitHub Pages to publish the site; the Pages section will show the final URL.

## Important limitations

- Playlist loading can fail when the remote source is unavailable or blocks browser requests through CORS. This static project does not include a proxy backend.
- A URL appearing in an M3U file does not guarantee that the stream is live, authorized, or compatible with the browser.
- HLS is supported when the stream and browser support it. Other formats may require a different playback engine or native app.
- Channel metadata and categories are inferred from playlist fields and names; the categorization is approximate.
- The project does not host or redistribute television streams. Use only playlists and streams you are authorized to access.
- This is a web app, not a signed native iOS `.ipa` package.

## Files

- `index.html` — app structure and player modal.
- `styles.css` — responsive glassmorphism UI and themes.
- `app.js` — playlist parser, state, filtering, favorites, and playback.
- `icon.svg` — app icon.
