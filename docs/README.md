# newspaper-system / site

Static frontend hosted on GitHub Pages. Loads the issue archive from the VPS and renders an interactive Hebrew flipbook.

## Setup

1. **Configure the server URL** — edit `js/config.js`:

```js
window.NEWSPAPER_CONFIG = {
  manifestUrl: "https://israelcodes.ovh/newspaper/manifest.json",
  storageBase: "https://israelcodes.ovh",
  preloadPages: 6,
  readAheadPages: 8,
};
```

2. **Enable GitHub Pages** — go to repo Settings → Pages → Source: `main` branch, `/ (root)` or `/site` folder.

3. **Set CORS on VPS** — the nginx snippet from `scripts/install.sh` adds the correct `Access-Control-Allow-Origin` header. Without it, the manifest fetch will fail in browsers.

## URL deep linking

- `https://you.github.io/repo/?issue=1218` opens that issue directly.
- Browser back/forward navigate between archive and viewer.

## Keyboard shortcuts (in viewer)

| Key | Action |
|---|---|
| `→` / `↑` | Previous page (RTL: flip right) |
| `←` / `↓` / `Space` | Next page (RTL: flip left) |
| `Esc` | Back to archive |
| `F` | Toggle fullscreen |

## Dependencies (no npm/build step)

- [StPageFlip](https://github.com/Nodlik/StPageFlip) v2.0.7 — MIT — loaded from jsDelivr CDN
- [Frank Ruhl Libre + Heebo](https://fonts.google.com) — loaded from Google Fonts

## TODO (future features)

- [ ] Full-text search via OCR (Tesseract → JSON index)
- [ ] RSS feed for new issues
- [ ] PWA manifest + service worker for offline reading
- [ ] Deep link to a specific page within an issue (`?issue=1218&page=12`)
- [ ] Email newsletter trigger on new issue upload
