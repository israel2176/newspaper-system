// ── Site configuration ────────────────────────────────────────────────────────

(function () {
  // When served directly from the VPS (israelcodes.ovh:8080) use relative paths.
  // When served from GitHub Pages use the full VPS URL.
  const onVPS = window.location.hostname === "emanuel-sheli.israelcodes.ovh";

  window.NEWSPAPER_CONFIG = {
    manifestUrl: onVPS
      ? "/newspaper/manifest.json"
      : "https://emanuel-sheli.israelcodes.ovh/newspaper/manifest.json",

    storageBase: onVPS ? "" : "https://emanuel-sheli.israelcodes.ovh",

    preloadPages: 6,
    readAheadPages: 8,
  };
})();
