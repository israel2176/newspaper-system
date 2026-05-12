// ── Site configuration ────────────────────────────────────────────────────────

(function () {
  // When served directly from the VPS (israelcodes.ovh:8080) use relative paths.
  // When served from GitHub Pages use the full VPS URL.
  const onVPS = window.location.hostname === "israelcodes.ovh";

  window.NEWSPAPER_CONFIG = {
    manifestUrl: onVPS
      ? "/newspaper/manifest.json"
      : "http://israelcodes.ovh:8080/newspaper/manifest.json",

    // storageBase is prepended to issue.path / issue.thumb from the manifest.
    // Empty string = same origin (works when served from VPS directly).
    storageBase: onVPS ? "" : "http://israelcodes.ovh:8080",

    preloadPages: 6,
    readAheadPages: 8,
  };
})();
