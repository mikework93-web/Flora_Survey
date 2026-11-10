// v3: probes many KeyBase routes. GET /api/key/<id> ; add ?debug=1 to see every attempt (plain text)
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const KB = "https://keybase.rbg.vic.gov.au";
const DW = "https://data.rbg.vic.gov.au/keybase-ws/ws";
function candidates(id) {
  const paths = [
    "/api/v1/key/get/", "/api/v1/key/", "/api/v1/keys/", "/api/v1/key_get/", "/api/v1/key/show/",
    "/api/key/get/", "/api/key/", "/api/keys/", "/api/key_get/", "/api/key/show/",
    "/api/v2/key/", "/api/v2/keys/", "/api/v1.1/key/", "/v1/key/", "/keys/get/", "/key/get/", "/key_get/",
    "/keybase/ws/key_get/", "/keybase/api/key/", "/keybase/api/v1/key/", "/keybase-ws/ws/key_get/", "/ws/v1/key_get/", "/ws/key/"
  ];
  const out = [];
  for (const p of paths) out.push(KB + p + id);
  out.push(KB + "/api/v1/key?key_id=" + id, KB + "/api/key?id=" + id, KB + "/keys/show/" + id + ".json");
  out.push(DW + "/key_get/" + id, "http://data.rbg.vic.gov.au/keybase-ws/ws/key_get/" + id, "https://aws.rbg.vic.gov.au/keybase-ws/ws/key_get/" + id);
  return out;
}
function valid(j) { return !!(j && (j.leads || (j.first_step && j.first_step.leads) || j.items)); }
async function one(url) {
  try {
    const r = await fetch(url, { headers: { "Accept": "application/json, */*", "User-Agent": UA, "Referer": KB + "/" }, redirect: "follow" });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch (e) { }
    return { url, status: r.status, json: !!j, valid: valid(j), body: text.slice(0, 90).replace(/\s+/g, " "), text };
  } catch (e) { return { url, error: String(e && e.message || e) }; }
}
export async function onRequestGet(context) {
  const id = String(context.params.id || "").replace(/[^0-9]/g, "");
  const debug = new URL(context.request.url).searchParams.has("debug");
  if (!id) return out({ error: "bad key id" }, 400);
  const res = await Promise.all(candidates(id).map(one));
  const hit = res.find(x => x.valid && x.status === 200);
  if (hit && !debug) return new Response(hit.text, { status: 200, headers: head("application/json; charset=utf-8") });
  const brief = res.map(x => ({ url: x.url, status: x.status, error: x.error, json: x.json, valid: x.valid, body: x.body }));
  const interesting = brief.filter(x => x.valid || (x.status && x.status !== 404));
  return out({ ok: hit ? hit.url : null, interesting, all: brief }, hit ? 200 : 502);
}
export async function onRequestOptions() { return new Response(null, { status: 204, headers: head("text/plain") }); }
function out(o, status) { return new Response(JSON.stringify(o, null, 1), { status, headers: head("text/plain; charset=utf-8") }); }
function head(ct) { return { "Content-Type": ct, "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" }; }
