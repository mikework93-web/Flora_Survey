// GET /api/key/<id>  -> KeyBase key JSON (server-side, avoids browser CORS). Add ?debug=1 for diagnostics (plain text).
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const KB = "https://keybase.rbg.vic.gov.au";
export async function onRequestGet(context) {
  const id = String(context.params.id || "").replace(/[^0-9]/g, "");
  const debug = new URL(context.request.url).searchParams.has("debug");
  if (!id) return out({ error: "bad key id" }, 400, true);
  const urls = [KB + "/api/v1/key_get/" + id, KB + "/api/key_get/" + id];
  const tried = [];
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { "Accept": "application/json", "User-Agent": UA, "Referer": KB + "/" }, redirect: "follow" });
      const text = await r.text();
      let j = null; try { j = JSON.parse(text); } catch (e) { }
      tried.push({ url, status: r.status, json: !!j, body: text.slice(0, 120) });
      if (j && r.status === 200 && (j.leads || (j.first_step && j.first_step.leads) || j.items)) {
        if (!j.leads && j.first_step && j.first_step.leads) j.leads = j.first_step.leads;
        if (debug) return out({ ok: url, keys: Object.keys(j), has_leads: !!j.leads }, 200, true);
        return new Response(JSON.stringify(j), { status: 200, headers: head("application/json; charset=utf-8") });
      }
    } catch (e) { tried.push({ url, error: String(e && e.message || e) }); }
  }
  return out({ error: "key not available", tried }, 502, debug);
}
export async function onRequestOptions() { return new Response(null, { status: 204, headers: head("text/plain") }); }
function out(o, status, text) { return new Response(JSON.stringify(o, null, 1), { status, headers: head(text ? "text/plain; charset=utf-8" : "application/json; charset=utf-8") }); }
function head(ct) { return { "Content-Type": ct, "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" }; }
