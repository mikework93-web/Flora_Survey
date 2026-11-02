/* Cloudflare Pages Function: /api/key/<id>
   Fetches an identification key from KeyBase on the server side and returns it to the app.
   The browser cannot call KeyBase directly (it does not allow cross-site requests), so the
   offline VicFlora download and VicKey use this instead of the slow public relays.
   Keys rarely change, so each one is cached at Cloudflare for a day. */
export async function onRequestGet({ params }) {
  const id = String(params.id || "");
  if (!/^[A-Za-z0-9_-]{1,20}$/.test(id)) return new Response("bad key id", { status: 400 });
  const up = await fetch("https://data.rbg.vic.gov.au/keybase-ws/ws/key_get/" + encodeURIComponent(id), {
    headers: { Accept: "application/json" },
    cf: { cacheTtl: 86400, cacheEverything: true }
  });
  return new Response(up.body, {
    status: up.status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=86400" }
  });
}
