const CHUNK_RELOAD_KEY = "medvault:chunk-reload";

const STALE_CHUNK_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|MIME type/i;

function reloadOnceForStaleChunks(): boolean {
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  window.location.reload();
  return true;
}

function failedAssetUrlFromTarget(target: EventTarget | null): string {
  if (target instanceof HTMLScriptElement) return target.src;
  if (target instanceof HTMLLinkElement) return target.href;
  return "";
}

/** Clear guard after a successful boot so a future deploy can trigger one more reload. */
export function clearStaleChunkReloadGuard() {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
}

/**
 * After a deploy, cached index.html can reference removed lazy chunks (Privy modals, etc.).
 * The CDN then serves HTML for missing /assets/*.js → MIME type errors. Reload once to pick up the new shell.
 */
export function registerStaleChunkRecovery() {
  if (!import.meta.env.PROD) return;

  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    reloadOnceForStaleChunks();
  });

  window.addEventListener(
    "error",
    (event) => {
      const msg = event.message ?? "";
      const assetUrl = event.filename || failedAssetUrlFromTarget(event.target);
      if (STALE_CHUNK_RE.test(msg) || assetUrl.includes("/assets/")) {
        reloadOnceForStaleChunks();
      }
    },
    true,
  );

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason ?? "");
    if (!STALE_CHUNK_RE.test(msg)) return;
    event.preventDefault();
    reloadOnceForStaleChunks();
  });
}
