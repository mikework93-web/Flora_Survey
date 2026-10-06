# Flora Survey — change log

Changes made to this copy of the app (started from your `Flora_Survey`). Plain-English summary, newest work first.

## Field fixes and features (2026-10-06)
- **Map crash fixed:** reshaping a polygon (dragging or adding a corner) rebuilt the corner handles in the middle of the drag, and a timer could fire after the map had closed. Both are now safe.
- **Camera:** each species now has separate **Take photo** (opens the camera) and **Choose photos** (gallery) buttons. The hidden file inputs no longer use display:none, which some Android versions ignored.
- **"Storage is full" fix (Android Chrome).** Surveys, and the draft that autosaves while you work, are now kept in IndexedDB (hundreds of MB) instead of localStorage (about 5 MB, which a survey with a few dozen photo thumbnails and GPS tracks could fill). Surveys already on a phone are moved across automatically the first time the new version opens, which frees the old space. If IndexedDB is unavailable the app falls back to localStorage as before. Opening a saved survey now works on a copy, so edits cannot leak into the saved entry until it is saved.
- **Offline VicFlora: "GraphQL error" fix.** A VicFlora error on one field no longer discards the rest of the response. If VicFlora rejects the big request for a group of taxa, the app asks for less (no descriptions, then names only) and fetches the missing descriptions one at a time afterwards. The error text now includes VicFlora's own message and where it happened.
- **VicKey: new "Genus key" tab.** Search a genus and read its full VicFlora key as a bracketed key (numbered couplets with "go to" links) or an indented key. Reads the keys saved by Offline VicFlora, so it works with no signal. Keys that hand over to a sub-key have an "Open its key" button with a Back button.
- **Offline VicFlora download is more robust.** It no longer gives up after 30 failures in total. It now backs off and retries when VicFlora is slow or rate-limiting, takes a large genus in smaller pieces if the single request fails, skips a taxon that keeps failing (and offers "Retry the missing parts" afterwards), and shows the real error. It stops only after 12 failures in a row, and progress is kept so Resume continues.
- **Polygon and point GeoPackage exports are now GDA2020 / MGA zone 55 (EPSG:7855)**: projected eastings/northings in metres, not WGS 84 lat/lon. Zone 55 is used for the whole state, including areas west of 144°E that are normally zone 54 (valid, with slightly larger scale distortion). GDA2020 and WGS 84 GPS positions are treated as identical (well under a metre apart). Import reads both the new projected files and older lat/lon files.
- **Google Satellite** added to the map layers.
- **Significant** now opens the map straight away to set the location. Cancel it to set the location later.
- **GPS tracking and boundary walking are steadier:** poor or stale fixes are ignored, movement smaller than the GPS error is ignored, sudden leaps need a second fix to confirm, and the GPS restarts cleanly when you return to the app.
- **Search:** species already in the survey (or polygon) are highlighted green with an Added tag. Search now forgives a typo or two, matches common names as well as botanical names, and also uses the offline VicFlora data when downloaded.
- **Import and merge fixed:** spreadsheets saved or edited in Excel (compressed, shared strings) now import. Old .xls files give a clear message to Save As .xlsx.
- **Export all** (Menu): one zip with every saved survey (Excel + GIS layers each, photos optional) plus combined GeoPackages of all points and polygons.
- **Edit record:** each species card has Edit record to fix the name, common name, origin, FFG and EPBC, or swap in another VicFlora species, keeping photos, notes and locations. Changes sync to Team Sync.

## Works offline (new)
- **The app now opens and runs with no signal.** A service worker (`sw.js`, next to `index.html`) saves the app, its images, the map library and the map tiles you have looked at. The page is still fetched fresh first when there is signal, so updates keep arriving.
- **Syncs when signal returns:** the app says when you go offline and come back, then sends queued Team Sync changes, pulls the team's, and checks for a new version. Entries are always saved on the phone first.
- Offline VicFlora data older than a month prompts you to update it when you are back online.
- Map tiles only work offline for areas you have already viewed.

## Offline VicFlora (new)
- **Menu > Offline VicFlora** downloads VicFlora onto the device: every taxon's name, common name, status and description, plus every identification key. No photos.
- Once finished, the survey species search, VicKey descriptions and VicKey key splits all work with no signal. Without the download everything works online as before.
- The download is resumable, shows progress, and can be updated or removed from the same screen.

## VicKey (new)
- **New VicKey tool** in the Menu and as a tile on the home screen. It compares two species, two genera or two families using VicFlora.
- **Species:** search a species, then pick another from the same genus. Shows their VicFlora descriptions side by side (leaves, culms, fruit and so on) and the step in the genus key where they separate.
- **Genus:** search a genus, then pick another from the same family. Shows the step in the family's genus key where they split.
- **Family:** search two families. Shows their descriptions side by side and the step in the families key where they split.
- **VicKey key loading:** key data now tries KeyBase directly, then the app's own relay (new file `functions/api/key/[id].js`, add the `functions` folder next to index.html in the repo), then public relays. If all fail, the message says why.
- **VicKey close button fixed:** the header now sits below the phone's status bar and notch, so the X is always reachable.
- **Feature table now sorted by botanical category** (habit and size, stems and culms, bark, leaves, ligules and sheaths, hairs, inflorescence, flowers, fruit and seeds, flowering time, distribution, similar species). Each phrase is filed by the plant part it describes, not by its first word.
- **Key split fix:** VicKey now picks the right key by rank (genus key for species, family key for genera) and shows the exact step where two taxa part ways, for example Allocasuarina paludosa vs A. paradoxa at Step 4, branchlet ribs with or without a median groove. If a taxon is keyed in more than one place it shows the earliest separating step.
- Descriptions come from VicFlora. Keys come from KeyBase, the key engine behind VicFlora. Needs a connection, and nothing is saved.

## Map
- **Fixed the page squashing after finishing a polygon** — the species box no longer grabs focus and pops the keyboard.
- **Fixed the species panel getting stuck** at the bottom of the map when dismissed.
- **Fixed the Add Point / Finish buttons showing underneath** the species panel.
- **Exit is now a clear ✕** instead of the small "‹" that read like a back arrow; same in every map mode.
- **Removed the floating green tick** in point mode — the "Save Point" bar is the single, obvious action.
- **"Adjust shape on map" now looks like a proper button** (outlined gold), so it's not confused with the gold "Add Polygon".
- **Survey Map no longer repeats the same instruction twice**; the second line shows a point/polygon count.
- Confirmed tapping a point that sits on a polygon correctly selects the point.

## Recording data
- **A name is now required before anything is logged** (species, polygon or field note), so records are never anonymous. It's checked every time, so it still applies if the name is cleared partway through.
- **If there's no name yet, a prompt now pops up saying "Enter your name or initials for the record"** with its own box to type in. It no longer throws you back to the "Your name" field without saying why. Once you enter a name, whatever you tapped (species, polygon, field note, start or join) carries on by itself. Cancel just closes it.
- **New look for the top of the page**, following the mockup: icons inside the Site, Date, Name, Join code and Search boxes (one person for your name, two people for the join code), a full-width gold "Start a live survey" bar, an "Or join a survey" divider with an outlined Join button, the long Team Sync explanation tucked into a tap-to-open "How team sync works" box, and the species/polygon counts shown as a small round badge.
- **Dark mode.** Menu > Dark mode / Light mode switches it and the phone remembers the choice. It always starts in light mode until someone picks dark. Same charcoal and gold, just dark cards and fields.
- **Top bar tidied:** the Menu button is now on the left with the standard three-line icon and a gold outline (it fills gold while open), and "Flora Survey" sits on the right. The menu drops down from the left.
- **Map top bar** now uses the same darker charcoal as the main toolbar, with the ✕ button keeping the lighter charcoal inside. Map side buttons (layers, GPS) are now visible in dark mode.
- **Solid strip behind the phone's back/home bar** so the app no longer shows through it on Android.
- **Map title** ("Draw polygon", "Survey map" etc) is now plain gold text like "Flora Survey", so it no longer looks like a button.
- **Deleting a polygon now asks first:** the ✕ on each polygon is a clear red-outlined button, and tapping it pops "Delete polygon PG1?" with Cancel / Delete. Nothing is removed unless you tap Delete.
- **Species and field notes ask before deleting too:** "Delete Kangaroo Grass?" / "Delete this field note?" with Cancel / Delete.
- **A little gold dragonfly** now sits at the very bottom of the page, under Check for updates. Tap it and it flutters.
- **Menu glow-up:** each option is now its own bordered tile (bigger and easier to tap) with a gold icon on a soft square: New survey, Saved folder, Map, Export, Save, Dark/Light mode (moon/sun) and Check for updates. Gold line across the top of the menu.
- **Map from the menu works now.** It was opening and instantly closing again (the menu's own "back" step was closing it). Same fix covers every menu option.
- **Draggy is now the real logo dragonfly**, in his normal colours and kept small. Still flutters when tapped.
- **Map side buttons are clearer:** proper icons with a small label under each: **Layers** (switch between satellite and street map), **Locate** (jump to where you are) and **Track** (record the path you walk; turns into a red pulsing **Stop** while recording).
- **Map page tidy:** the ✕ is now a **Back to survey** button with an arrow; the redundant Close button at the bottom is gone; bottom buttons (Undo / Add pt / Finish / Add Polygon) have their icon beside the label instead of stacked; the instruction strip under the top bar is slimmer; zoom + / − match the app in dark mode.
- **New polygon icon** on the map's Add Polygon button: a wide, thin-lined gold boundary shape with a dot on each corner.
- **Add Polygon from the Survey Map works now.** It was closing the map and dumping you back on the survey page. Now it goes straight into drawing. If no survey is started yet (no site), it first asks "Start a survey first: which site is this for?" and then carries on.
- **Live indicator glow-up:** the Team Sync status is now a proper chip with a pulsing green dot (Live), a blinking amber dot (Connecting) or red (Offline, retrying). The share code sits in a clear card with a one-tap **Copy** button, and Sync now / Leave sync are proper buttons.
- **Update banner is harder to miss:** taller, slides up from the bottom, says "Update ready", and has draggy in a little gold circle on the left giving a wiggle every couple of seconds. Bigger Update button.
- **Species search snaps to the top:** tapping the Add species box pulls that card up under the toolbar, so the suggestions list has room and you can see what comes up while typing.
- **After adding a species** the page scrolls so the new entry is in view.
- **Collapse moved onto the species name line** when you reopen an older species, so it no longer pushes the VicFlora Key pill out of the card.
- **Recorded species cards redesigned** to match the rest of the app: bigger name with the scientific name, record ID and who recorded it underneath, plus round tags (Indigenous / Invasive, Significant, Uncertain). Origin, Significant and Uncertain sit together in a shaded strip, with Significant and Uncertain as tap-able pills that light up gold / red when on. Set location lives in that strip too.
- **One clear "Notes & photos" button** (with a down arrow that flips when open, and little counters for notes and photos) replaces the separate Field Notes and Photos pills, which both opened the same panel. VicFlora sits beside it.
- **Delete moved to its own "Delete species" button** at the bottom of the card (with a bin icon), so it no longer looks like it belongs to Uncertain. Still asks before deleting.
- **Collapse is now a small up-arrow button** at the top right of a reopened species.
- Draggy sits a little lower in his update-banner badge so the wings are centred.
- **Collapsed species rows always show the scientific name on its own line** under the common name (short names used to pull it up onto the same line).
- **Tags and Significant / Uncertain pills are square** to match the rest of the app. Significant is gold everywhere.
- **Delete confirmations pop up mid-screen** where you are working, with the question and the Cancel / Delete buttons on one line.
- **Origin is now an app-style switch** (Indigenous | Invasive side by side, green or red when picked) instead of the phone's own dropdown picker.
- **Date field opens an app calendar** when you tap anywhere on it (not just the little arrow). The calendar matches the app: charcoal header with month arrows, weeks start Monday, today outlined in gold, the chosen day filled gold, plus Today and Cancel buttons. The date shows as e.g. "Sat, 3 Oct 2026".
- **Team Sync live status chip moved to the right** of the TEAM SYNC heading.
- **Significant and Uncertain now line up exactly** under Indigenous and Invasive.
- **Every species can be collapsed**, including the newest one at the top (it still opens by default when you add it).
- **Ticking Significant no longer jumps into the map.** It shows the Set location button and a quick reminder instead, so you can pin it when ready. (Adding an FFG / EPBC listed species still opens the map straight away, as before.)
- **Sync now results pop up mid-screen with an OK button** instead of a quick toast: "All synced" (with your count vs the team's), "Partly synced", or "Sync didn't go through" with a plain-English reason. They stay until you tap OK.
- **Longer toasts stay on screen longer** so there's time to read them.
- **Leave sync asks first:** "Leave live sync? Your species stay on this phone." with Cancel / Leave. If some changes haven't reached the team yet, it says how many.
- **Adjust shape is a one-job trip:** Finish saves the new shape and takes you straight back to the survey ("Polygon shape updated"). A **Cancel** button sits beside Undo / Add pt / Finish and leaves the polygon exactly as it was ("No changes made").
- **More app-style confirmations:** deleting a polygon from the Survey Map, deleting a saved survey, and starting a new survey now use the app's own pop-up instead of the phone's.
- **Prompts you type into now sit near the top of the screen** ("Start a survey first" and "Enter your name or initials"), so the phone keyboard can't cover them.
- **Small toasts lift above the keyboard** when it's open.
- **"Origin" label dropped** from the species card; the Indigenous | Invasive switch and the Significant / Uncertain pills now use the full width (still lined up).
- **Indigenous / Invasive tag moved to the collapsed species rows** (where it's useful at a glance) and off the open card, where the switch already shows it.
- **Surveys are now an intentional thing.** With nothing open, the page shows Site + Date and a big **Start survey** button; Add species, Recorded species, Polygons, Summary and Field notes stay hidden until you start (a note explains why). Joining a teammate's live survey starts one automatically, and so does opening a saved survey.
- **In progress badge and Finish survey.** While a survey is running, Survey details shows an IN PROGRESS badge and a **Finish survey** button. Finish offers Cancel / Export first / Finish; Finish files it in the Saved folder, clears the page for the next survey and confirms "Survey filed".
- **Menu > New survey** now means "finish this one first" when a survey is open.
- **Polygon species use the same search picker as Add species** (no more comma-separated typing): pick species into tidy chips, tap × on a chip to remove it. Same picker in the map after drawing a polygon and when you tap a polygon on the Survey Map.
- **Polygon and field-note cards redesigned** to match species cards: name and details at the top, an "Adjust shape on map" button with a map icon, and **Delete polygon / Delete note** at the bottom (still asks first). Field notes now record who wrote them.
- **Saved folder (and Import / Merge / Export pop-ups) restyled** with tiles and bigger buttons. The survey you have open is marked **Open now**.
- **New home page (the first thing you see when no survey is open).** Big tiles: **Start a new survey** (gold), **Open a saved survey** (drops down your saved surveys, newest first, with date and species / polygon / note counts, plus Import), **Join a team survey**, and **How it works** (four steps: start, record, survey together, finish). Start and Join take you to Survey details and Team Sync, with a Home button to go back.
- **Adjusting shows you the original.** Adjust shape now opens zoomed to fit the whole polygon (it used to open so close in that big polygons were off-screen) and keeps a dashed white outline of the original shape underneath while you move corners. Adjusting a species point shows an orange dot labelled **Original** where it was, so you can see how far you've moved it.
- **Your other polygons and points show while you draw or place.** Drawing a new polygon, adjusting one, or setting / adjusting a species point now shows everything else already in the survey: other polygons as faint dashed gold shapes (no labels, to keep the map clear), and points as blue dots. They can't be tapped by accident, so they never get in the way. With no GPS fix yet, a new drawing opens framed on the survey's existing shapes instead of all of Victoria.
- **Picking species for a polygon on the map no longer disappears under the keyboard.** While you type, the species sheet moves to the top of the screen with the suggestions underneath.
- **Saved point coordinates use a gold map-pin icon** instead of the pin emoji. The point's **Remove** button is red and now asks "Remove this point?" first.
- **More map layers** (Layers button): **Vicmap Aerial** is now the default (the Victorian Government's own imagery: sharper and more recent close up; zoomed out it switches to Esri underneath because Vicmap's zoomed-out tiles are grainy), plus Esri Imagery, **Esri Topographic** (terrain, tracks, contours) and OpenStreetMap. An optional **Road & place names** layer sits on top (VIC), which also names the reserves. All free. If you pick a different layer, the app remembers it. Small credit lines show in the corner, as the imagery licences require.
- **Add a corner between two corners:** while drawing or adjusting a polygon, each edge has a small **+** in the middle. Tap it to add a corner there, or drag it to pull a new corner straight into place.
- **Save and Export on the home page** no longer pretend: with no survey open they're greyed out in the menu and say "No survey open" instead of "Saved".
- **Import fixed up.** Importing from the home page worked but the list didn't refresh, so it looked like nothing happened. Now the list updates and you're asked "Imported ... Open it now?". The file picker also accepts the GIS file on phones that didn't recognise it, and import problems show in a card with OK instead of a quick toast. (Tested: export, then import of the same files brings back every species, point, note and polygon.)

## Look and feel
- **Field boxes, empty states, summary tiles and polygon inputs are pure white** now, so they stand out as things to fill in.
- **"Start a live survey" and "Join" darkened** so they're easy to read on the light card.
- **Squared the corners up** across the app for a crisper look.
- Header logo and icons moved out to real image files, so the page is a bit lighter.

## Wording and layout
- **"Checklist" renamed to "Recorded species"** — it lists what you've recorded, not a to-do list.
- **Search box and help text shortened** so nothing is cut off on a phone.
- **"Enter code" and "Join" now share one line** on mobile (were stacked).
- Dropped the "e.g. Mike" / "e.g. Reserve" placeholder hints.

## Updates
- **The "new version available" notice is now a bar along the bottom in the app's colours** (was a blue bar up top).
- **"Check for updates" added to the Menu**, in case the notice is dismissed.

## Under the hood
- The trial **offline mode (service worker) was removed** — the app already keeps data locally and syncs when it can. It self-clears from any phone that cached it.
- File renamed to `index.html` so it serves at the site root on Cloudflare.

## Not done yet / worth a look
- The date field is styled to match, but the **calendar pop-up itself is the phone's native one** (making it fully app-styled needs a custom picker).
- Some help text still uses long dashes.
