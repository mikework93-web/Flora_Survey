# Handoff — Flora Survey (Keystone Conservation)

Context for a fresh Claude Code session picking this up. Read this first, then read `index.html`.

## What this is
A field botany survey PWA. It's **our working copy** of a friend's (Mike's) app, which Lani is
polishing. Improve it; don't rebrand ("Keystone Conservation" stays) or rip working features out.
Propose big structural moves before doing them.

- **Repo:** `github.com/GreenGauge-ops/Keystone-survey` (private), branch `main`.
- **Local:** `C:\Users\User\Documents\GitHub\Keystone-survey`.
- **Deploy:** Cloudflare Pages → `keystone-survey.pages.dev`. **A push to `main` auto-deploys.**
- **Upstream:** seeded from `mikework93-web/Flora_Survey` (his file is `keystone-flora-survey-teamsync-dev.html`; we renamed it to `index.html` for root serving).

## Architecture
- **Single file:** `index.html` (~5,600 lines), **vanilla JS + Leaflet only**, no build step, no framework. Keep it that way.
- Plus real image files pulled out of the HTML: `logo.png`, `apple-touch-icon.png`, `favicon-32.png`, `favicon-16.png`. (The web manifest is still an inline `data:` URI in the head.)
- **Map:** Leaflet, in a full-screen modal (`MapModal`, an IIFE ~line 3900). Esri World Imagery + OSM basemaps. Three modes: `point` (Set/adjust a Significant species location), `polygon` (draw/walk an area), `overview` ("Survey Map", shows everything). Lots of iOS viewport hardening already in there (visualViewport height, body-scroll lock, history guard).
- **Team Sync = Firestore** (Firebase, config committed inline — fine, client config is public). Opt-in "Start a live survey" / "Join". Degrades offline: queues writes (`livequeue`) and retries; species search falls back to a bundled list.
- **Theme:** colours are CSS vars on `:root`; `html[data-theme="dark"]` overrides them. A tiny head script sets `data-theme` before paint from `localStorage.fh_theme`, else light (default is light on purpose, not the phone setting). Menu `#fhTheme` toggles + saves. Use `var(--field)`/`var(--page)` etc, never hardcode `#fff` backgrounds.
- **Storage:** localStorage + IndexedDB (photos).
- **Exports:** hand-rolled **XLSX** and **GeoPackage (.gpkg)**. Clever and fragile — leave alone unless the task is them.
- **Update mechanism:** `BUILD_VERSION` constant (currently `2026-09-29.1`). `checkForUpdate()` re-fetches the page, compares the constant, and `showUpdateBanner()` shows a bottom bar. There's a cross-teammate "different version" warning too.

## Conventions (important)
- **Bump `BUILD_VERSION`** (search it, ~line 1880) on every change so the update banner fires for the team.
- **Commit with a real message and push to `main`** — this is delegated (same as Lani's other apps). Push = live Cloudflare deploy, so it's fine to push, just be deliberate.
- **No em dashes in text you write** (Lani's standing rule). Some of Mike's existing prose still has them; cleaning those up is a nice-to-have, not done yet.
- **Keep human judgement** — don't auto-decide native/invasive or auto-ID species.
- Test by serving locally (`npx serve -l <port>` in the repo) and driving it in a browser; check the console is clean; then push.
- **There is no service worker** (deliberately removed). A block near the end of the script actively unregisters any SW + clears `keystone-*` caches, so don't re-add one without a reason.

## Key functions / where things live
- `MapModal` (~3900): `open`, `build`, `footForPoint/Polygon/Overview`, `renderOverviewLayers`, `returnToOverview`, `showSpeciesSheet`, `confirmCurrentLocation`. The sheet + scrim sit at card level so the sheet fully hides and the scrim covers the footer.
- `add(sp)` (~4780): logs a species. `openAddPolygonFlow` (~5430), `addSiteNote` (~3870): the other creation actions. All three call `requireName()` (~line 2025) first.
- **Survey lifecycle:** `surveyStarted` (saved in snapshot as `started`; legacy saves count as started if they have a site or content). `applySurveyState()` (called from render) toggles `body.no-survey`, which hides `.survey-only` cards and shows #surveyStart / #lockedNote. `startSurvey()` needs a site. `requireSite(retry)` now means "a survey must be in progress" (prompt pre-fills the site). `finishSurvey()` = Cancel / Export first / Finish; Finish writes the folder copy, sets sessionStorage `fh_filed`, then `startNewSurvey()` reloads and shows a "Survey filed" notice. Joining live (renderLiveUI active branch) starts a survey.
- **Home page** (`#homeView`, top of .wrap): shown when `body.no-survey` and not `body.starting`. Tiles: Start (adds .starting, shows #surveyCard + #liveCard with a Home back button), Open (toggles #homeOpenPanel with `renderHome()` list), Join (starting + scroll to Team Sync), How it works (#homeHowPanel). `openSavedSurvey(key)` is the single "open from folder" path (leaves live first), used by home and the Saved folder modal.
- **Testing: never Start/Join live in a test browser**; it writes to Mike's Firebase. Check localStorage `fh_florasurvey_live` is empty before testing.
- `mountSpeciesChips(host, list, onChange, inline)`: chips + FHKit.buildPicker, used by the Polygons list and both map sheets. Stores names as strings (scientific name, or free text) exactly like the old comma field, so export/sync are unchanged.
- MapModal history guard defers its pushState (+ popstate listener) while a previous close()'s history.back() is still in flight (`backPending`/`pushWaiting`). That is what lets close()-then-open() (overview → Add Polygon) work.
- Team Sync uses Firebase project `flora-survey-bf874` (Mike's, shared with his original app). Test live sessions land in his Firestore.
- Species card (`fullRowHtml`): .sp-head (name, sci line, badges, .sp-collapse) → .sp-controls (Origin = .origin-seg radio pair carrying data-origin, same change handler as the old select, .sp-flag Significant/Uncertain pills, .sp-geo location lines) → .sp-tools (one Notes & photos toggle = data-notes-toggle, VicFlora link) → .notes-row → .sp-foot (Delete = data-del). Icons in `SP_ICON`; icon children get pointer-events:none so e.target.dataset handlers still see the button.
- `FHKit.notice(title, msg, kind)`: centred message card that waits for OK (kind ok|warn|error). Use it for results worth reading; FHKit.toast now scales its duration with message length.
- MapModal `opts.adjusting` (set by adjustPolygonShape): footer gains Cancel, and Finish closes the map entirely instead of returning to the overview.
- Native `confirm()` still remains only in the Team Sync start/join/give-up-reconnect warnings (long multi-line text); everything else uses confirmToast.
- Prompt cards with an input use `.name-ask.typing` (top-anchored, clear of the keyboard). FHKit.toast offsets its bottom by the keyboard height via visualViewport.
- MapModal context layers: `drawContext()` (in ensureMap) draws the survey's other polygons/points non-interactively in point and polygon modes, from `opts.contextData` or `getOverviewData`; `editingPolygonId` / `editingPoint` exclude the thing being edited. `drawOriginals()` adds the dashed original outline / orange Original dot when adjusting.
- Basemaps: `BASE_LAYERS` (vicmap default, esri, topo, osm; vicmap has `under:"esri"` + minZoom 15 because its low zooms are grainy) + `LABELS_LAYER` (Vicmap CARTO_OVERLAY) in MapModal; choice saved in localStorage `fh_basemap` \/ `fh_labels`. Vicmap URL pattern: `https:\/\/base.maps.vic.gov.au\/wmts\/<LAYER>_WM_256\/EPSG:3857:256\/{z}\/{x}\/{y}.png` (max native z20). Attribution control is ON (licences require it).
- Polygon edges get `makeMidMarker` "+" handles (tap = insert corner, drag = insert and move); not shown while walking.
- `confirmToast(msg, okLabel, onOk)`: bottom confirm card (same look as askName), onOk only on the red button. Used for polygon, species and field-note delete, and Leave sync; reuse it for other destructive actions.
- `requireName(retry)`: blocks logging when the name field is empty and pops `askName(retry)`, a bottom toast-style card with its own input ("Enter your name or initials for the record"); on Continue it fills `#userName`, saves it, then re-runs `retry` so the action completes. Start/Join live use `askName` directly.
- Toolbar/menu build (~5555): the "…" Menu (New / Saved Folder / Map / Export / Save / Check for updates), with a history guard so Back closes it.
- Menu options run through `menuAct(fn)`: it closes the menu and waits for its history back-step (popstate) BEFORE running fn. Any new menu item must use it, or a modal that pushes history (MapModal) gets closed instantly.
- `showUpdateBanner()` / `checkForUpdate()` (~1885): the update bar + check. `.toast` / `FHKit.toast` (~205 / ~750): the general toast.

## Done so far
See `CHANGELOG.md` for the plain-English list. Technically: pulled the trial service worker; renamed to index.html; fixed the finish-polygon jank (auto-focus keyboard squash, stuck sheet, stacked footer, duplicate hint); clear ✕ exit; removed the redundant confirm tick; required a name before logging; recoloured the update banner to a bottom bar + added the Menu check; fixed the mobile join-code line; squared all corners; whitened field/empty/summary boxes; darkened Start/Join; distinct "Adjust shape" button; renamed Checklist → Recorded species; shortened the search placeholder + help text; menu Back-button guard; extracted base64 images to PNGs.

## Open threads / possible next steps
- **Team Sync polygons look refused by Firebase.** In testing, species and device writes went through but queued polygon creates on survey F4NCK2 kept getting 403 (permission denied). Likely Mike's Firestore rules don't allow the `polygons` subcollection. Needs checking in his Firebase console.
- ~~Custom date picker~~ DONE (v2026-09-27.20): `#date` is now a hidden ISO input whose `value` property is wrapped (Object.defineProperty) so any code setting it refreshes `#dateBtn`; the calendar is built in an IIFE just before the "if(!$("date").value)" default.
- **Em-dash sweep** across Mike's remaining help text, if wanted.
- **Extract the web manifest** to a real `manifest.json` (last big inline line in the head).
- Consider whether point-save inside the map should also be name-gated (currently the three creation actions are; a point attaches to a species that already required a name).

## Working style
Lani wants momentum: just build it, keep replies digestible, light testing, they deploy and eyeball. Don't over-ask or over-explain.
