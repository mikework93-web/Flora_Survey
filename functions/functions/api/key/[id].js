// v2 (diagnostic text/plain)
// Cloudflare Pages Function: GET /api/key/<id>   (add ?debug=1 to see what each attempt returned)
// Fetches an identification key from KeyBase on the server, because browsers can't call it directly (CORS).
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
export async function onRequestGet(context) {
  const id = String(context.params.id || "").replace(/[^0-9]/g, "");
  const debug = new URL(context.request.url).searchParams.has("debug");
  if (!id) return out({ error: "bad key id" }, 400);
  const urls = [
    "https://data.rbg.vic.gov.au/keybase-ws/ws/key_get/" + id,
    "https://data.rbg.vic.gov.au/keybase-ws/ws/key_get?key_id=" + id,
    "https://keybase.rbg.vic.gov.au/ws/key_get/" + id,
    "https://keybase.rbg.vic.gov.au/ws/key_get?key_id=" + id,
    "https://keybase.rbg.vic.gov.au/keybase-ws/ws/key_get/" + id
  ];
  const tried = [];
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { "Accept": "application/json, text/plain, */*", "User-Agent": UA, "Referer": "https://keybase.rbg.vic.gov.au/" }, redirect: "follow" });
      const text = await r.text();
      let j = null; try { j = JSON.parse(text); } catch (e) { }
      tried.push({ url, status: r.status, json: !!j, leads: !!(j && j.leads), body: text.slice(0, 160) });
      if (j && j.leads && !debug) return new Response(text, { status: 200, headers: head() });
    } catch (e) {
      tried.push({ url, error: String(e && e.message || e) });
    }
  }
  const ok = tried.find(t => t.leads);
  if (ok && debug) return out({ ok: ok.url, tried }, 200);
  return out({ error: "key not available", tried }, 502);
}
export async function onRequestOptions() { return new Response(null, { status: 204, headers: head() }); }
function out(o, status) { var h = head(); h["Content-Type"] = "text/plain; charset=utf-8"; return new Response(JSON.stringify(o, null, 1), { status, headers: h }); }
function head() { return { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" }; }
