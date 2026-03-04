const CACHE="tb1-cards-v8.6";
const ASSETS=["./","./index.html","./styles.css","./app.js","./data.js","./datatexte.js","./datadictionary.js","./manifest.json"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(self.clients.claim())});
self.addEventListener("fetch",e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(net=>{
    if(e.request.method==="GET"){const copy=net.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{})}
    return net;
  }).catch(()=>r)));
});