// ── Site configuration ────────────────────────────────────────────────────────
// Edit these values to match your setup.

window.NEWSPAPER_CONFIG = {
  // Full URL to manifest.json on your VPS
  manifestUrl: "https://israelcodes.ovh/newspaper/manifest.json",

  // Base URL of your VPS (no trailing slash)
  // Issue image paths from manifest.json are appended to this
  storageBase: "https://israelcodes.ovh",

  // Number of pages to preload at startup (first N pages of the open issue)
  preloadPages: 6,

  // Pages to load ahead/behind the current spread while reading
  readAheadPages: 8,
};
