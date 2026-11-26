// Offline cache, the same pattern as Heartbeat. Cache-first, refreshed in the background.
// Bump the cache name with every release (it matches the version number) so the new build installs.
const C="bb-1.2.0",FILES=["./","index.html","assets/calculator.js","assets/calculator.css","assets/fonts.css","fonts/Archivo-wdth.woff2","fonts/ArchivoNarrow-Bold.woff2","fonts/ArchivoNarrow-SemiBold.woff2","fonts/IBMPlexMono-Medium.woff2","fonts/IBMPlexMono-Regular.woff2","fonts/PublicSans-Italic.woff2","fonts/PublicSans.woff2","icon.svg","icon-180.png","icon-512.png","manifest.webmanifest"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:"reload"})))).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("message",e=>{if(e.data==="skip")self.skipWaiting();});
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET"||new URL(r.url).origin!==location.origin)return;
  e.respondWith(caches.open(C).then(c=>c.match(r,{ignoreSearch:true}).then(hit=>{const net=fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res;}).catch(()=>hit);return hit||net;})));});
