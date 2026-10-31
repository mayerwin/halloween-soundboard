// Offline support. build.mjs fills in VERSION and SHELL (the page's content-hashed files), so a
// new build is a new service worker that caches the new shell and drops the old one.
// Sounds go into their own cache (kept across versions: their URLs carry ?v=<content hash>):
// each one when first played, or all at once from the card's "Make it work offline".
const VERSION = "__VERSION__";
const SHELL = __SHELL__;
const APP = `app-${VERSION}`;
const SOUNDS = "sounds-v1";
// origins that serve sounds with CORS, so they can be cached as real responses
const SOUND_HOSTS = ["assets.mixkit.co", "sound-effects-media.bbcrewind.co.uk"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("app-") && k !== APP) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isSound = (url) => url.pathname.includes("/sounds/") || SOUND_HOSTS.includes(url.hostname);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate") {
    // the page itself: fresh when online, the cached copy when not
    e.respondWith(fetch(req).then((r) => {
      const copy = r.clone();
      caches.open(APP).then((c) => c.put("./", copy));
      return r;
    }).catch(() => caches.match("./", { ignoreSearch: true })));
    return;
  }
  if (isSound(url)) {
    e.respondWith((async () => {
      const hit = await caches.match(req.url, { cacheName: SOUNDS });
      if (hit) return hit;
      const r = await fetch(req);
      // a background track's <audio> asks for byte ranges (206): those aren't cached
      if (r.status === 200 && (url.origin === self.location.origin || r.type === "cors")) {
        const copy = r.clone();
        caches.open(SOUNDS).then((c) => c.put(req.url, copy));
      }
      return r;
    })());
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: false }).then((hit) => hit || fetch(req)));
  }
});

// "Make it work offline": cache every sound the page lists, reporting progress
self.addEventListener("message", (e) => {
  if (e.data?.type !== "cache-all") return;
  const client = e.source;
  e.waitUntil((async () => {
    const c = await caches.open(SOUNDS);
    let done = 0, failed = 0;
    const urls = e.data.urls;
    let i = 0;
    const worker = async () => {
      while (i < urls.length) {
        const u = urls[i++];
        try {
          if (!(await c.match(u))) {
            const r = await fetch(u, { mode: "cors" });
            if (!r.ok) throw new Error(r.status);
            await c.put(u, r);
          }
        } catch (err) { failed++; }
        done++;
        if (done % 5 === 0 || done === urls.length) client?.postMessage({ type: "cache-progress", done, total: urls.length, failed });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  })());
});
