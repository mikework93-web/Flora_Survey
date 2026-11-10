// Cloudflare Pages Function: GET /api/key/<id>
// Fetches an identification key from KeyBase on the server and hands it back to the app,
// because the browser is not allowed to call KeyBase directly (CORS).
export async function onRequestGet(context) {
  const id = String(context.params.id || "").replace(/[^0-9]/g, "");
  if (!id) return new Response('{"error":"bad key id"}', { status: 400, headers: head() });
  const url = "https://data.rbg.vic.gov.au/keybase-ws/ws/key_get/" + id;
  try {
    const r = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "FloraSurvey/1.0 (Keystone Conservation)" },
      cf: { cacheTtl: 86400, cacheEverything: true }
    });
    const body = await r.text();
    return new Response(body, { status: r.status, headers: head() });
  } catch (e) {
    return new Response(JSON.stringify({ error: "key service unreachable", detail: String(e && e.message || e) }), { status: 502, headers: head() });
  }
}
export async function onRequestOptions() { return new Response(null, { status: 204, headers: head() }); }
function head() {
  return { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=86400" };
}
