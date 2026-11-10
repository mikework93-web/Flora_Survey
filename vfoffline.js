/* VicFlora offline store.
   Downloads the VicFlora classification (every taxon with its description, names and
   key links) and every identification key (from KeyBase) onto this device, so species
   search and VicKey work with no signal. Photos are not downloaded.
   Data: VicFlora, Royal Botanic Gardens Victoria (CC BY). Keys are served by KeyBase.
   The download is resumable: if it is interrupted, open it again and tap Resume. */
(function () {
  "use strict";
  var DB = "fh_vicflora_offline", VER = 1;
  var KEY_WS = "https://keybase.rbg.vic.gov.au/api/v1/key_get/";
  var F = "id taxonRank taxonomicStatus taxonName{fullName} establishmentMeans epbc ffg " +
          "preferredVernacularName{name} identificationKeys{id title} currentProfile{profile}";
  var Q_ROOT = "query($id:ID!){taxonConcept(id:$id){id taxonRank taxonomicStatus taxonName{fullName} identificationKeys{id title} higherClassification{id}}}";
  var Q_UP = "query($id:ID!){taxonConcept(id:$id){children{" + F + "}}}";
  var Q_GENUS = "query($id:ID!){taxonConcept(id:$id){children{" + F + " children{" + F + "}}}}";
  var Q_FAM = "query($q:String!){taxonConceptAutocomplete(q:$q){id taxonRank}}";
  var WALK = { LIFE: 1, KINGDOM: 1, SUBKINGDOM: 1, PHYLUM: 1, SUBPHYLUM: 1, CLASS: 1, SUBCLASS: 1, SUPERORDER: 1, ORDER: 1, SUBORDER: 1, FAMILY: 1, GENUS: 1, SECTION: 1 };
  var SURVEY_RANKS = { SPECIES: 1, SUBSPECIES: 1, VARIETY: 1, FORM: 1, GENUS: 1 };

  var db = null, idx = null, meta = null, running = false, stopFlag = false, listeners = [];
  var byId = {}, kids = {}, names = [], lastError = "", consecFail = 0, wakeLock = null;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- IndexedDB ---------- */
  function open() {
    if (db) return Promise.resolve(db);
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error("no indexedDB"));
      var r = indexedDB.open(DB, VER);
      r.onupgradeneeded = function () {
        var d = r.result;
        d.createObjectStore("taxa", { keyPath: "id" });
        d.createObjectStore("profiles", { keyPath: "id" });
        d.createObjectStore("keys", { keyPath: "id" });
        d.createObjectStore("meta", { keyPath: "id" });
      };
      r.onsuccess = function () { db = r.result; res(db); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(stores, mode, fn) {
    return open().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(stores, mode), out;
        out = fn(t);
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }
  function getOne(store, id) {
    return open().then(function (d) {
      return new Promise(function (res, rej) {
        var r = d.transaction(store, "readonly").objectStore(store).get(id);
        r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
      });
    });
  }
  function getAll(store) {
    return open().then(function (d) {
      return new Promise(function (res, rej) {
        var r = d.transaction(store, "readonly").objectStore(store).getAll();
        r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
      });
    });
  }
  function saveMeta() { return tx(["meta"], "readwrite", function (t) { t.objectStore("meta").put(meta); }); }

  /* ---------- in-memory index (names only, small) ---------- */
  function buildIndex(list) {
    byId = {}; kids = {}; names = [];
    list.forEach(function (t) {
      byId[t.id] = t;
      if (t.parent) (kids[t.parent] = kids[t.parent] || []).push(t.id);
      names.push(t);
    });
    names.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  }
  function init() {
    return open().then(function () { return getOne("meta", "state"); }).then(function (m) {
      meta = m || { id: "state", finished: null, queue: null, keyQueue: null, counts: { taxa: 0, keys: 0, fail: 0 }, seenKeys: {} };
      return getAll("taxa");
    }).then(function (list) { buildIndex(list); idx = true; emit(); }).catch(function () { idx = false; });
  }
  function ready() { return !!(idx && meta && meta.finished && names.length); }
  function summary() { return meta ? { finished: meta.finished, taxa: names.length, keys: meta.counts.keys, partial: !meta.finished && names.length > 0 } : null; }
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) { } }); }

  /* ---------- reading (used by search and VicKey) ---------- */
  function lc(s) { return String(s || "").toLowerCase(); }
  function searchNames(q, ranks, limit) {
    q = lc(q).trim();
    if (!q) return [];
    var starts = [], epi = [], common = [], seen = {};
    for (var i = 0; i < names.length; i++) {
      var t = names[i];
      if (ranks && !ranks[t.rank]) continue;
      if (t.status && t.status !== "ACCEPTED") continue;
      var n = lc(t.name);
      if (n.indexOf(q) === 0) starts.push(t);
      else if (n.indexOf(" " + q) >= 0) epi.push(t);
      else if (t.common && lc(t.common).indexOf(q) >= 0) common.push(t);
      if (starts.length >= (limit || 40)) break;
    }
    return starts.concat(epi, common).slice(0, limit || 40);
  }
  function searchSurvey(q) {
    return searchNames(q, SURVEY_RANKS, 40).map(function (t) {
      return { sci: t.name, common: t.common || "", lf: "", type: (t.em && String(t.em).toUpperCase().indexOf("NATIVE") === 0) ? "indigenous" : "invasive", ffg: t.ffg || "", epbc: t.epbc || "", status: t.status || "", source: "vicflora" };
    });
  }
  function ref(t) { return { id: t.id, taxonRank: t.rank, taxonomicStatus: t.status, taxonName: { fullName: t.name }, identificationKeys: t.keys || [] }; }
  // Same shape as the online VicKey query.
  function node(id) {
    var t = byId[id];
    if (!t) return Promise.resolve(null);
    var chain = [], p = t.parent;
    while (p && byId[p] && chain.length < 30) { chain.unshift(ref(byId[p])); p = byId[p].parent; }
    return getOne("profiles", id).then(function (pr) {
      var o = ref(t);
      o.higherClassification = chain;
      o.currentProfile = pr ? { profile: pr.text } : null;
      return o;
    });
  }
  function children(id) { return (kids[id] || []).map(function (c) { return ref(byId[c]); }); }
  function keyJson(id) {
    return getOne("keys", String(id)).then(function (k) { return k ? k.json : null; }).catch(function () { return null; });
  }

  /* ---------- remote helpers ---------- */
  function gql(query, vars, ms) { return window.FHVicFlora.query(query, vars, ms || 60000); }
  function keySources(id) {
    var u = KEY_WS + encodeURIComponent(id);
    return [
      { name: "relay", url: "api/key/" + encodeURIComponent(id) },
      { name: "direct", url: u },
      { name: "corsproxy", url: "https://corsproxy.io/?" + encodeURIComponent(u) },
      { name: "allorigins", url: "https://api.allorigins.win/raw?url=" + encodeURIComponent(u) }
    ].filter(function (s) { return (srcFails[s.name] || 0) < 8; });
  }
  var keyErrors = [], srcFails = {};
  function fetchKeyRemote(id) {
    var chain = Promise.reject(new Error("start"));
    keySources(id).forEach(function (src) {
      chain = chain.catch(function () {
        var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
        var to = ctrl && setTimeout(function () { ctrl.abort(); }, 12000);
        return fetch(src.url, { headers: { "Accept": "application/json" }, signal: ctrl ? ctrl.signal : undefined })
          .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
          .then(function (j) { if (j && !j.leads && j.first_step && j.first_step.leads) j.leads = j.first_step.leads;
            if (!j || !j.leads) throw new Error("not a key"); srcFails[src.name] = 0; return j; })
          .catch(function (e) {
            srcFails[src.name] = (srcFails[src.name] || 0) + 1; keyErrors.push(src.name + ": " + (e && e.message === "Failed to fetch" ? "blocked or offline" : (e && e.message) || "failed")); throw e; })
          .finally(function () { if (to) clearTimeout(to); });
      });
    });
    return chain;
  }
  function retry(fn, n) {
    return fn().catch(function (e) {
      if (n <= 0) throw e;
      return new Promise(function (r) { setTimeout(r, 1500 * (4 - n)); }).then(function () { return retry(fn, n - 1); });
    });
  }

  /* ---------- download ---------- */
  function rec(t, parent) {
    return {
      id: t.id, parent: parent || null, rank: t.taxonRank, status: t.taxonomicStatus,
      name: (t.taxonName && t.taxonName.fullName) || "", common: (t.preferredVernacularName && t.preferredVernacularName.name) || "",
      em: t.establishmentMeans || "", epbc: t.epbc || "", ffg: t.ffg || "",
      keys: (t.identificationKeys || []).map(function (k) { return { id: String(k.id), title: k.title }; })
    };
  }
  function storeBatch(list, parent) {
    // list: taxa from the API; nested children handled by the caller.
    return tx(["taxa", "profiles"], "readwrite", function (t) {
      list.forEach(function (x) {
        var r = rec(x.t, x.parent);
        t.objectStore("taxa").put(r);
        var p = x.t.currentProfile && x.t.currentProfile.profile;
        if (p) t.objectStore("profiles").put({ id: r.id, text: p });
        if (!byId[r.id]) { (kids[r.parent] = kids[r.parent] || []).push(r.id); meta.counts.taxa++; }
        byId[r.id] = r;
        r.keys.forEach(function (k) { if (!meta.seenKeys[k.id]) { meta.seenKeys[k.id] = 0; meta.keyQueue.push(k.id); } });
      });
    });
  }
  function holdAwake(on) {
    try {
      if (on) {
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
        if (navigator.wakeLock && !wakeLock) navigator.wakeLock.request("screen").then(function (l) { wakeLock = l; l.addEventListener("release", function () { wakeLock = null; }); }).catch(function () { });
      } else if (wakeLock) { wakeLock.release(); wakeLock = null; }
    } catch (e) { }
  }
  document.addEventListener("visibilitychange", function () { if (running && document.visibilityState === "visible") holdAwake(true); });
  function status(text, done, total) { run.state = { text: text, done: done || 0, total: total || 0 }; emit(); }
  var run = { state: { text: "", done: 0, total: 0 } };

  function startDownload(fresh) {
    if (running) return Promise.resolve();
    running = true; stopFlag = false; lastError = ""; consecFail = 0; srcFails = {}; keyErrors = [];
    holdAwake(true);
    var p = Promise.resolve();
    if (fresh || !meta || !meta.queue) {
      p = clearAll().then(function () {
        meta = { id: "state", finished: null, queue: [], keyQueue: [], counts: { taxa: 0, keys: 0, fail: 0 }, seenKeys: {}, started: new Date().toISOString() };
        byId = {}; kids = {}; names = [];
        status("Finding the top of the VicFlora classification...");
        return gql(Q_FAM, { q: "Cyperaceae" }, 20000).then(function (j) {
          var fam = ((j.data && j.data.taxonConceptAutocomplete) || []).filter(function (t) { return t.taxonRank === "FAMILY"; })[0];
          if (!fam) throw new Error("no family");
          return gql(Q_ROOT, { id: fam.id }, 20000);
        }).then(function (j) {
          var h = j.data.taxonConcept.higherClassification || [];
          var rootId = h.length ? h[0].id : j.data.taxonConcept.id;
          return gql(Q_ROOT, { id: rootId }, 20000).then(function (r) { return r.data.taxonConcept; });
        }).then(function (root) {
          return storeBatch([{ t: root, parent: null }]).then(function () { meta.queue.push(root.id); return saveMeta(); });
        });
      });
    }
    p = p.then(function () {
      // Jobs that were in flight when the last run was interrupted were taken off the queue but never finished.
      if (meta.inflight && meta.inflight.length) { meta.inflight.forEach(function (i) { if (meta.queue.indexOf(i) < 0) meta.queue.push(i); }); }
      meta.inflight = []; meta.failedOnce = 0; meta.splitIds = meta.splitIds || {};
    });
    return p.then(treePhase).then(keyPhase).then(function () {
      if (stopFlag) { status("Paused. Open this again and tap Resume to continue."); return; }
      meta.finished = new Date().toISOString();
      return saveMeta().then(function () { return getAll("taxa"); }).then(function (l) { buildIndex(l); status("Done"); });
    }).catch(function (e) {
      try { saveMeta(); } catch (x) { }
      status("Stopped: " + ((e && e.message) || "error") + (lastError && lastError !== (e && e.message) ? " (last error: " + lastError + ")" : "") + ". Check your connection, then tap Resume.");
    }).then(function () { running = false; holdAwake(false); emit(); });
  }
  function clearAll() {
    return open().then(function () { return tx(["taxa", "profiles", "keys", "meta"], "readwrite", function (t) { ["taxa", "profiles", "keys", "meta"].forEach(function (s) { t.objectStore(s).clear(); }); }); });
  }

  function pool(n, nextFn) {
    var workers = [], active = 0;
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    for (var i = 0; i < n; i++) workers.push((function loop() {
      var job = stopFlag ? null : nextFn();
      if (!job) {
        // Other workers may still queue more work (e.g. a genus's children), so wait for them.
        if (!stopFlag && active > 0) return wait(250).then(loop);
        return Promise.resolve();
      }
      active++;
      return job.then(function () { active--; }, function (e) { active--; throw e; }).then(loop);
    })());
    return Promise.all(workers);
  }
  function treePhase() {
    var initial = meta.queue.length, since = 0;
    return pool(3, function () {
      if (!meta.queue.length) return null;
      var id = meta.queue.shift();
      var node = byId[id];
      // A big genus (Eucalyptus, Acacia, Poa...) can be too heavy to fetch with all its species in one go.
      // If it fails, fetch just its species, then each species' own subtaxa separately.
      var split = !!(meta.splitIds && meta.splitIds[id]);
      var q = (node && node.rank === "GENUS" && !split) ? Q_GENUS : Q_UP;
      meta.inflight = (meta.inflight || []).concat([id]);
      return retry(function () { return gql(q, { id: id }, 90000); }, split ? 3 : 1).then(function (j) {
        if (j && j.errors && j.errors.length && !(j.data && j.data.taxonConcept)) throw new Error(j.errors[0].message || "VicFlora error");
        var c = (j.data && j.data.taxonConcept && j.data.taxonConcept.children) || [], list = [];
        c.forEach(function (x) {
          list.push({ t: x, parent: id });
          if (WALK[x.taxonRank] || split) { meta.queue.push(x.id); }
          (x.children || []).forEach(function (y) { list.push({ t: y, parent: x.id }); });
        });
        consecFail = 0;
        return storeBatch(list);
      }).catch(function (e) {
        lastError = (e && e.message) || "request failed";
        meta.counts.fail++; consecFail++;
        if (node && node.rank === "GENUS" && !split) { meta.splitIds[id] = 1; }   // retry this genus in smaller pieces
        meta.queue.push(id);
        if (consecFail >= 12) { stopFlag = true; throw new Error("12 requests in a row failed (" + lastError + ")"); }
        return new Promise(function (r) { setTimeout(r, Math.min(20000, 1000 * consecFail * consecFail)); });
      })
        .then(function () {
          meta.inflight = (meta.inflight || []).filter(function (i) { return i !== id; });
          if (++since % 5 === 0) saveMeta();
          status("Downloading names and descriptions (" + meta.counts.taxa + " taxa so far)", meta.counts.taxa, 0);
        });
    }).then(function () { return saveMeta(); });
  }
  function keyPhase() {
    if (stopFlag) return Promise.resolve();
    var total = Object.keys(meta.seenKeys).length, since = 0;
    return pool(4, function () {
      var id = null;
      while (meta.keyQueue.length) { var c = meta.keyQueue.shift(); if (meta.seenKeys[c] !== 1) { id = c; break; } }
      if (!id) return null;
      return retry(function () { return fetchKeyRemote(id); }, 1).then(function (j) {
        var title = j.key_title || "";
        meta.seenKeys[id] = 1; meta.counts.keys++;
        (j.items || []).forEach(function (it) { if (it.to_key && meta.seenKeys[it.to_key] === undefined) { meta.seenKeys[it.to_key] = 0; meta.keyQueue.push(String(it.to_key)); } });
        return tx(["keys"], "readwrite", function (t) { t.objectStore("keys").put({ id: String(id), title: title, json: j }); });
      }).catch(function () { meta.counts.fail++; meta.failedKeys = (meta.failedKeys || 0) + 1; })
        .then(function () {
          if (++since % 10 === 0) saveMeta();
          total = Object.keys(meta.seenKeys).length;
          status("Downloading identification keys (" + meta.counts.keys + " of " + total + ")", meta.counts.keys, total);
        });
    }).then(function () {
      var missing = Object.keys(meta.seenKeys).filter(function (k) { return meta.seenKeys[k] !== 1; });
      if (missing.length && !stopFlag) {
        // keep unreachable keys listed but do not block finishing
        meta.missingKeys = missing;
      }
      return saveMeta();
    });
  }

  /* ---------- UI ---------- */
  var ov = null;
  function fmtDate(s) { try { return new Date(s).toLocaleDateString(); } catch (e) { return s; } }
  function render() {
    if (!ov) return;
    var s = summary(), st = run.state, body = ov.querySelector(".vo-body");
    var h = "";
    if (running) {
      var pct = st.total ? Math.min(100, Math.round(100 * st.done / st.total)) : 0;
      h += '<p class="vo-line"><b>Downloading.</b> Keep this screen open and stay on Wi-Fi if you can.</p>' +
        '<p class="vo-line">' + esc(st.text) + "</p>" +
        (st.total ? '<div class="vo-bar"><i style="width:' + pct + '%"></i></div>' : '<div class="vo-bar ind"><i></i></div>') +
        '<div class="vo-btns"><button type="button" class="btn light" id="voStop">Pause</button></div>';
    } else {
      if (s && s.finished) {
        h += '<p class="vo-line"><b>Ready for offline use.</b> ' + s.taxa.toLocaleString() + " taxa and " + s.keys.toLocaleString() + " keys saved on this device (" + esc(fmtDate(s.finished)) + ").</p>" +
          '<p class="vo-line muted">Species search, descriptions and VicKey now work with no signal. Photos are not saved.</p>' +
          '<div class="vo-btns"><button type="button" class="btn" id="voUpdate">Update data</button><button type="button" class="btn light" id="voRemove">Remove from this device</button></div>';
      } else if (s && s.partial) {
        h += '<p class="vo-line"><b>Download paused.</b> ' + s.taxa.toLocaleString() + ' taxa saved so far. Offline features turn on when it finishes.</p>' +
          (st.text ? '<p class="vo-line">' + esc(st.text) + "</p>" : "") +
          '<div class="vo-btns"><button type="button" class="btn" id="voGo">Resume</button><button type="button" class="btn light" id="voRemove">Start over</button></div>';
      } else {
        h += '<p class="vo-line">Save all of VicFlora (names, descriptions and identification keys, no photos) on this device so species search and VicKey work with no signal.</p>' +
          '<p class="vo-line muted">This is a large download that can take a while. Use Wi-Fi and keep this screen open. If it stops, reopen this and tap Resume.</p>' +
          (st.text ? '<p class="vo-line">' + esc(st.text) + "</p>" : "") +
          '<div class="vo-btns"><button type="button" class="btn" id="voGo">Download for offline use</button></div>';
      }
    }
    h += '<p class="vo-foot">Data: VicFlora, Royal Botanic Gardens Victoria (CC BY). Keys: KeyBase.</p>';
    body.innerHTML = h;
    var b;
    if ((b = body.querySelector("#voGo"))) b.onclick = function () { startDownload(false); render(); };
    if ((b = body.querySelector("#voUpdate"))) b.onclick = function () { startDownload(true); render(); };
    if ((b = body.querySelector("#voStop"))) b.onclick = function () { stopFlag = true; b.disabled = true; b.textContent = "Pausing..."; };
    if ((b = body.querySelector("#voRemove"))) b.onclick = function () {
      if (!confirm("Remove the offline VicFlora data from this device?")) return;
      clearAll().then(function () { meta = { id: "state", finished: null, queue: null, keyQueue: null, counts: { taxa: 0, keys: 0, fail: 0 }, seenKeys: {} }; buildIndex([]); run.state = { text: "", done: 0, total: 0 }; emit(); });
    };
  }
  function openUI() {
    if (ov) return;
    ov = document.createElement("div");
    ov.className = "fh-modal";
    ov.innerHTML = '<div class="fh-modal-card"><h3>Offline VicFlora data</h3><div class="vo-body" style="padding:14px 16px"></div><div class="fh-modal-foot"><button class="ghost" data-close="1">Close</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov || e.target.closest("[data-close]")) { ov.remove(); ov = null; } });
    render();
  }
  listeners.push(render);

  window.VFOffline = {
    init: init, ready: ready, summary: summary, openUI: openUI, onChange: function (f) { listeners.push(f); },
    searchNames: searchNames, searchSurvey: searchSurvey, node: node, children: children, keyJson: keyJson,
    fetchKeyRemote: fetchKeyRemote, keyErrors: function () { return keyErrors; }
  };
  init();
})();
