# AGENTS.md

Notes for coding agents (and humans) working on this repo, or using it to put the soundboard on
their own Home Assistant.

## What this is

A Halloween soundboard published as a static site on GitHub Pages. It is a public export of a
soundboard that also runs on Home Assistant, where a server-side engine drives many speakers at
once. Here the only speaker is the page itself.

## Layout

| Path | What | Origin |
|---|---|---|
| `src/soundboard-card.js` | The UI: a vanilla web component (`<soundboard-card>`), no framework; its English and French words (`I18N`, `CAT_FR`) | Copied from the Home Assistant version, byte for byte |
| `src/soundboard-local.js` | The engine, in the browser: queue, haunt mode, background layers, settings, history, presets, export/import | Hand-written |
| `src/site.js`, `src/site.css`, `src/index.html` | The page around the card: `<ha-icon>` stand-in, page words (EN/FR), credits dialog, toasts, install button | Hand-written |
| `src/sw.js`, `src/manifest.webmanifest`, `src/icon-*.png` | Offline app: service worker (shell precache filled in by `build.mjs`, sounds cached on play or all at once) and install metadata | Hand-written |
| `src/library.json` | The sound list: id, title, category, duration, url, license, author, source | Generated |
| `src/icons.js` | The Material Design Icons paths the card uses | Generated |
| `src/sounds/`, `src/fonts/` | Audio files, the two fonts (+ their OFL licenses) | Generated |
| `build.mjs` | `src/` to `dist/` with content-hashed names (cache busting) | Hand-written |
| `CREDITS.md`, the credits in `README.md` | Generated from `library.json` | Generated |

The maintainer regenerates this repo with an export script, which also
scans everything for leaked private data (addresses, entity ids, names, tokens) before anything
can be committed. A pull request is welcome, but a change to a generated file has to be ported
upstream to survive the next export: say so in the PR.

## Guidelines followed

- **No dependencies, no bundler.** Plain ES modules and web components; `build.mjs` only copies and
  renames. Keep it that way: the page must keep working from any static host.
- **No trackers.** Fonts and icons are served from this site. The only third-party requests are
  the sounds played from their origin (below). Nothing a visitor does leaves their browser
  (localStorage key `soundboard.local.v1`).
- **Cache busting is content-based.** Every asset name carries its content hash; sounds carry
  `?v=<hash>`. Never reference an asset by a fixed name from a cached file without going through
  `build.mjs` (it rewrites references by file name, leaves first, and fails on a cycle).
- **Only redistributable sounds are copied here.** CC0, public domain, CC BY, CC BY-NC (this
  site is non-commercial), plus the halloweensoundboard.com loops (credited). Sounds whose
  license forbids redistributing the file (Mixkit) or limits use to personal use (BBC RemArc) are
  **not copied**: their `url` points at their own server and the browser plays them from there
  (`gain` evens out their loudness with the rest); the installed app caches them for offline use. Every sound needs `license`, `author` and,
  when there is one, `source_url`: they feed the credits.
- **Two languages.** Every word the UI shows goes through `T()` (card) or `P()` (page), with an
  English and a French entry. Sound titles have a `title_fr`; what a voice says (quoted lines, spoken
  phrases like "Run!") stays verbatim in both.
- **Volume is perceptual.** Sliders map to gain squared (`taper`), so 50 % sounds about half as
  loud. Background tracks in Mix can go to 150 %; the HA engine soft-limits the sum.
- **Plain words in the UI**, written for the person holding the phone at the door, not for an
  engineer. Every control has an accessible label. The ambience (fog, lightning, bats) always
  runs: the owner wants it even with the OS's animation effects turned off.

To add a sound: put the file under `src/sounds/sfx/<category>/` (or `src/sounds/music/`), add an
entry to `library.json` with its real `duration` in seconds, `license`, `author` and `source_url`,
then run `node build.mjs` and check it in `dist/`.

## Card <-> engine contract

The card never plays anything by itself except on "This device". It talks to an engine through two
calls of a Home Assistant-style connection object, which is what `soundboard-local.js` implements:

- `hass.connection.subscribeMessage(cb, {type: "soundboard/subscribe", device_id, device_name})`:
  the engine sends `{type: "state", state}` on every change, and `{type: "cmd", ...}` to make this
  device play something.
- `hass.callWS(msg)` for everything else:

| `type` | Fields | Effect |
|---|---|---|
| `soundboard/library` | `theme` | Returns the theme: `{id, name, emoji, accent, accent2, categories, sfx: [item], music: [item]}` |
| `soundboard/settings` | `patch` | Deep-merges into the settings (shape below) |
| `soundboard/music` | `action`: play, stop, next, prev | Background |
| `soundboard/queue` | `action`: add (`items: [{type: "sound", id} or {type: "pause", duration}]`), remove (`uid`), clear, play, replay, stop, skip | Effects queue |
| `soundboard/hide` | `theme, ids, hidden` | Hide / unhide |
| `soundboard/mark` | `theme, ids, fav?, down?` | Favourite / thumbs-down (also hides) |
| `soundboard/undo` | `entry` | Undo a history entry that has `undo` |
| `soundboard/preset` | `action`: save (`name`) or delete (`preset`) | Presets; the card applies one as a settings patch |
| `soundboard/stop_all` | | Stops everything |
| `soundboard/warm` | `on` | HA only: keep camera / Cast streams open |
| `soundboard/play_now` | `sound, speakers` | HA only: straight to these speakers, not queued, mixed over what they play |
| `soundboard/data` | `action`: export, import (`data`), reset | Standalone only |
| `auth/sign_path` | `path` | HA signs media URLs; standalone returns the path as is |

Settings: `{theme, music: {tracks, speakers, volume, loop, mix, levels: {track: 0-1.5}},
sfx: {speakers, volume, gap, loop, autoplay, pause_s}, trim: {speaker: 0-1}}`.
State: `{settings, hidden, marks, presets, history, warm, outputs: [{id, name, group, kind,
available, ready}], themes, music: {playing, mix, layers: [{id, track, title, duration, started,
index, count}]}, queue: {running, items, current, current_started, gap_until}, server_time}`.
Commands to a device: `sfx {url, volume}`, `sfx_stop`, `sfx_volume {volume}`,
`music {layer, url, offset, volume, title, loop}`, `music_stop {layer?}`, `music_volume {layers}`.

Card config: `{standalone: true}` (this site: no speaker list, data tab) or `{guest: true}` (no
favourite / hide buttons, no preset saving, no history).

## Putting it on your own Home Assistant

There the engine is a custom integration (Python), so playback goes on when the dashboard
closes and any number of phones can control it. That code is specific to one setup and is
not published here, but everything needed to rebuild it is the contract above plus these lessons,
each of which cost real debugging time:

1. **Serve the card yourself and register it as a Lovelace resource** (`module`, with a
   `?v=<content hash>`), not with `frontend.add_extra_js_url`: extra modules can load before the
   frontend's scoped custom-element registry exists, and the card then randomly fails to render.
   Serve the `fonts/` folder next to it.
2. **"This device" is just an output** that forwards the `cmd` messages above to the subscribed
   browser. A phone paired with a Bluetooth speaker becomes a portable speaker. Mobile browsers
   only play audio after a tap: the card unlocks a pool of `<audio>` elements on the first one.
3. **Media URLs need HA signatures, and a refused signed link counts as a failed login.** After
   60 of them HA bans the IP. Never replay a refused link; re-sign, and back off a failing URL.
4. **Camera speakers behind go2rtc** (two-way audio backchannel): a one-shot `play_media` takes 6 to 8 s
   to open the backchannel every time. Keep one endless real-time WAV stream attached instead
   (go2rtc `/api/ffmpeg?dst=<camera rtsp>&live=<your stream url>`), carrying silence until a sound
   is mixed in: effects then start in well under a second. go2rtc drops an RTSP session that
   receives nothing after about 60 s, and a send-only backchannel receives nothing: run an
   audio-only reader on the same in-memory stream to keep it alive. Yield to any other playback
   (another announcement) instead of fighting it.
5. **Google Cast speakers can't mix two sounds.** Serve each one a live MP3 that you mix
   yourself (background layers + effects). Left alone, a Cast speaker can buffer about 27 s of a live stream
   before playing; sending `media_play` about 0.5 s after it connects starts it at once, after
   which it plays a steady ~2.4 s behind (measured from its `media_position`). To keep every
   speaker in sync, write the effect into the Cast stream first and start the others that much
   later, pipelined so back-to-back effects stay back to back.
6. **Sonos** overlays effects as announcements (`announce: true`, `extra.volume`), ducking its own
   music; for a mixed background it plays the live stream as `x-rincon-mp3radio://`.
7. **Volume:** wherever you mix, set the speaker itself to full while you hold it and make both
   sliders pure digital gain. Setting the speaker to "the louder slider" and compensating the other
   digitally does not work: speaker volume curves are not linear, and the speaker's change lands
   seconds before the stream's. Give each speaker its own volume back afterwards, only if nobody
   changed it meanwhile, and persist that across restarts.
8. **Guests:** a non-admin user can still read every entity and call every service in HA. To
   give someone just the soundboard, put a gateway in front that forwards only the
   play / queue / settings commands, and validate every settings patch and queue item server side.

If you build it, the card needs no change: give it a `hass` whose `soundboard/*` messages reach
your engine.
