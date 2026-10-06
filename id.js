// Cloudflare Pages Function: relays VicFlora/KeyBase key data to the app
// from the same origin, so the browser never hits a cross-origin block.
// Served at /api/key/<keyId>. Read only, public data, cached for a day.
export async function onRequestGet({ params }) {
  const id = String(params.id || "").replace(/\D/g, "");
  if (!id) return new Response("bad id", { status: 400 });
  const r = await fetch("https://data.rbg.vic.gov.au/keybase-ws/ws/key_get/" + id, {
    headers: { Accept: "application/json" },
    cf: { cacheTtl: 86400, cacheEverything: true }
  });
  return new Response(r.body, {
    status: r.status,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=86400" }
  });
}
