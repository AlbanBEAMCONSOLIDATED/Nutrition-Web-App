const CACHE_NAME = "nutrition-cache-v10";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest"
];

// Install: cache core assets (ignore failures so SW still installs)
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(
      ASSETS.map(async (url) => {
        try{
          const req = new Request(url, {cache: "reload"});
          const res = await fetch(req);
          if(res.ok) await cache.put(req, res.clone());
        }catch(_){}
      })
    );
    self.skipWaiting();
  })());
});

// Activate: cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

// Fetch: network-first for same-origin GET, fallback to cache
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if(req.method !== "GET") return;
  if(url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    try{
      const res = await fetch(req);
      if(res && res.ok){
        cache.put(req, res.clone());
      }
      return res;
    }catch(_){
      const cached = await cache.match(req);
      return cached || cache.match("./index.html");
    }
  })());
});
