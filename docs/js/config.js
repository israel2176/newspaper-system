// ── Site configuration ────────────────────────────────────────────────────────

(function () {
  // When served directly from the VPS (israelcodes.ovh:8080) use relative paths.
  // When served from GitHub Pages use the full VPS URL.
  const onVPS = window.location.hostname === "emanuel-sheli.israelcodes.ovh";

  window.NEWSPAPER_CONFIG = {
    manifestUrl: onVPS
      ? "/newspaper/manifest.json"
      : "http://emanuel-sheli.israelcodes.ovh:8080/newspaper/manifest.json",

    storageBase: onVPS ? "" : "http://emanuel-sheli.israelcodes.ovh:8080",

    preloadPages: 6,
    readAheadPages: 8,
  };
})();
