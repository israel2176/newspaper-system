// ── Site configuration ────────────────────────────────────────────────────────
// The site and the issues are served together by Vercel, so all paths are
// relative. Issues live in /newspaper/ (written by scripts/newspaper_pipeline.py).

window.NEWSPAPER_CONFIG = {
  manifestUrl: '/newspaper/manifest.json',
  storageBase: '',
  readAheadPages: 6,   // pages to preload around the current spread
};
