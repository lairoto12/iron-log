// Iron Log service worker: lets the app open offline.
// App files: network first (so updates arrive), cached copy when offline.
// Libraries and fonts from CDNs: cache first (they're version-pinned).
// Model weights are cached by the AI libraries themselves, not here.
const SHELL = "ironlog-shell-v1";
const CDN = "ironlog-cdn-v1";
const FILES = ["./", "index.html", "app.js", "ai.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
const CDN_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== CDN).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
    );
  } else if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(CDN).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok || res.type === "opaque") c.put(req, res.clone());
        return res;
      })))
    );
  }
});
