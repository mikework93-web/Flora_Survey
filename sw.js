/* Flora Survey service worker: lets the app open and run with no signal.
   - The app page is network first (so updates and the BUILD_VERSION check keep
     working), falling back to the saved copy when offline or the signal is bad.
   - Images, Leaflet and map tiles are saved as they are used.
   - Data calls (Firebase team sync, VicFlora, KeyBase) are never touched here.
   Bump CACHE when the list of saved files changes. */
const CACHE = "keystone-shell-v2";
const TILES = "keystone-tiles-v1";
const MAX_TILES = 3000;
const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist/";
const SHELL = ["index.html", "logo.png", "favicon-16.png", "favicon-32.png", "apple-touch-icon.png", "draggy-sm.png"];
const CDN = [LEAFLET + "leaflet.css", LEAFLET + "leaflet.js", LEAFLET + "images/layers.png", LEAFLET + "images/layers-2x.png",
  LEAFLET + "images/marker-icon.png", LEAFLET + "images/marker-icon-2x.png", LEAFLET + "images/marker-shadow.png"];
const TILE_HOSTS = ["tile.openstreetmap.org", "arcgisonline.com", "maps.vic.gov.au", "basemaps.cartocdn.com", "opentopomap.org", "mt0.google.com", "mt1.google.com", "mt2.google.com", "mt3.google.com"];
const PAGE_KEY = new URL("index.html", self.registration.scope).href;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // The page itself must be saved; the rest is best effort.
    await c.add(new Request("index.html", { cache: "reload" }));
    await Promise.allSettled(SHELL.slice(1).map((u) => c.add(new Request(u, { cache: "reload" }))));
    await Promise.allSettled(CDN.map((u) => c.add(new Request(u, { mode: "cors" }))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keep = [CACHE, TILES];
    for (const k of await caches.keys()) if (k.indexOf("keystone-") === 0 && keep.indexOf(k) < 0) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function networkFirstPage(req) {
  const c = await caches.open(CACHE);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);   // poor signal: fall back to the saved page
    const res = await fetch(req, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    if (res && res.ok) { c.put(PAGE_KEY, res.clone()); return res; }
    throw new Error("bad");
  } catch (e) {
    const hit = await c.match(PAGE_KEY);
    if (hit) return hit;
    return fetch(req);
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req, { ignoreSearch: true });
  const net = fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

async function cacheFirst(req, cacheName) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
  return res;
}

async function tile(req) {
  const c = await caches.open(TILES);
  const hit = await c.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === "opaque")) {
      await c.put(req, res.clone());
      const keys = await c.keys();
      if (keys.length > MAX_TILES) for (const k of keys.slice(0, keys.length - MAX_TILES)) await c.delete(k);
    }
    return res;
  } catch (e) {
    return new Response("", { status: 504 });   // blank tile while offline and not yet saved
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.indexOf("/api/") === 0) return;
    if (req.mode === "navigate" || url.pathname === "/" || /\/index\.html$/.test(url.pathname) || /\/keystone-flora-survey-teamsync-dev\.html$/.test(url.pathname)) {
      e.respondWith(networkFirstPage(req)); return;
    }
    if (/\.(png|jpg|jpeg|svg|ico|webp|css|js|json)$/.test(url.pathname)) { e.respondWith(staleWhileRevalidate(req, CACHE)); return; }
    return;
  }
  if (url.hostname === "unpkg.com") { e.respondWith(cacheFirst(req, CACHE)); return; }
  if (TILE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith("." + h))) { e.respondWith(tile(req)); return; }
  // everything else (Firebase, VicFlora, KeyBase, relays) goes straight to the network
});
