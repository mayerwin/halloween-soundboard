// soundboard-local.js: the soundboard's engine, running in the browser.
//
// The card (soundboard-card.js) is the same one that runs in Home Assistant, where a server-side
// engine drives the house speakers over a websocket. Here this module answers the same messages
// (callWS / subscribeMessage, see AGENTS.md "Card <-> engine contract"), with one speaker: the
// page itself. Everything you change (settings, favourites, hidden sounds, presets, history) is
// kept in this browser's localStorage, under the site's own key (sibling sites share an origin).
// The theme comes from the library (its id, words, categories); nothing here is theme-specific.
const HISTORY_MAX = 200;
const HISTORY_SENT = 60;
const PRESETS_MAX = 30;
const MAX_QUEUE = 150;
const DEFAULT_LEVEL = 1;

const DEFAULTS = {
  theme: "",
  // spoken sounds shown, by language; null = the page's language, [] = all
  voice_langs: null,
  music: { tracks: [], volume: 0.6, loop: true, mix: false, levels: {} },
  sfx: { volume: 0.8, gap: 0, loop: false, autoplay: true, pause_s: 5 },
  haunt: { on: false, min_s: 20, max_s: 90, cats: [], favs: false },
  // listen with this device's microphone and fade everything out at a noise (themes with "hush")
  hush: { on: false, sens: 8, hold_s: 10 },
};
// in mixing mode, the ticked tracks of the "music" group share one layer and play one after
// another; every ambience is a layer of its own
const MUSIC_LAYER = "music";

// the history's words (the card translates everything else)
const WORDS = {
  en: { you: "You", undid: (t) => `Undid: ${t}`, hid: "Hid", unhid: "Unhid", fav: "Favourited", unfav: "Unfavourited",
    disliked: "Disliked", undisliked: "Un-disliked", mix: (on) => `Background mixing ${on ? "on" : "off"}`,
    started: (mix, t) => `Started background${mix ? " mix" : ""}: ${t}`, stopped: "Stopped background", cleared: "Cleared the effects queue",
    saved: (n) => `Saved preset “${n}”`, deleted: (n) => `Deleted preset “${n}”`, haunt: (on, m) => `${m} ${on ? "on" : "off"}`, stop_all: "STOP ALL",
    mode: "Random mode", hush: (on) => `Hush at a noise ${on ? "on" : "off"}` },
  fr: { you: "Vous", undid: (t) => `Annulé : ${t}`, hid: "Masqué", unhid: "Affiché", fav: "Favori", unfav: "Retiré des favoris",
    disliked: "Pas aimé", undisliked: "Plus « pas aimé »", mix: (on) => `Mélange ${on ? "activé" : "désactivé"}`,
    started: (mix, t) => `Fond sonore lancé${mix ? " (mélange)" : ""} : ${t}`, stopped: "Fond sonore arrêté", cleared: "File d'effets vidée",
    saved: (n) => `Préréglage « ${n} » enregistré`, deleted: (n) => `Préréglage « ${n} » supprimé`, haunt: (on, m) => `${m} ${on ? "activé" : "désactivé"}`, stop_all: "TOUT ARRÊTER",
    mode: "Mode aléatoire", hush: (on) => `Silence au moindre bruit ${on ? "activé" : "désactivé"}` },
};

// slider position -> amplitude: squared, so 50 % sounds about half as loud (same as the HA engine)
const taper = (v) => v * v;
const clone = (o) => JSON.parse(JSON.stringify(o));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())).replace(/-/g, "").slice(0, 10);
const now = () => Date.now() / 1000;
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const merge = (dst, src) => {
  for (const k in src) {
    if (isObj(src[k]) && isObj(dst[k])) merge(dst[k], src[k]);
    else dst[k] = src[k];
  }
  return dst;
};

export class LocalSoundboard {
  // store: the localStorage key (one per site: sibling sites on one origin must not share it).
  // Its content is keyed by theme where it matters (hidden, marks, presets), so a site with
  // several themes could keep them all under one key.
  constructor(library, lang = "en", { store = "soundboard.local.v1" } = {}) {
    this.lang = lang === "fr" ? "fr" : "en";
    this.store = store;
    this.lib = library; // theme dict: {id, name, emoji, accent, accent2, look, words, categories, sfx: [...], music: [...]}
    this.items = new Map([...library.sfx, ...library.music].map((i) => [i.id, i]));
    this.subs = new Set();
    this.deviceId = null;
    this.version = 0;
    this.data = this.load();
    // background
    this.layers = new Map();
    this.mPlaying = false;
    this.mMix = false;
    // queue
    this.qItems = [];
    this.qRun = null; // token of the running queue loop
    this.qCurrent = null;
    this.qGapUntil = 0;
    this.qWake = null; // resolves the current wait early (skip / stop)
    this.qHeld = 0; // when the hush began holding the queue (0: not held), see hold()
    this.qFreeze = null; // stands the current pause still / lets it run again
    this.qUnhold = null;
    this.connection = { subscribeMessage: (cb, msg) => this.subscribe(cb, msg) };
  }

  // ----- persistence -----
  load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(this.store)) || {}; } catch (e) { /* private mode, corrupt */ }
    return this.normalise(saved);
  }

  normalise(saved) {
    const defaults = clone(DEFAULTS);
    // a theme with music and ambiences starts in mixing mode (a carol over the crackling fire)
    if (typeof this.lib.mix === "boolean") defaults.music.mix = this.lib.mix;
    const d = {
      settings: merge(defaults, isObj(saved.settings) ? saved.settings : {}),
      hidden: isObj(saved.hidden) ? saved.hidden : {},
      marks: isObj(saved.marks) ? saved.marks : {},
      presets: Array.isArray(saved.presets) ? saved.presets.slice(-PRESETS_MAX) : [],
      history: Array.isArray(saved.history) ? saved.history.slice(-HISTORY_MAX) : [],
    };
    const s = d.settings;
    s.theme = this.lib.id;
    s.haunt.on = false; // a reloaded page can't play before a tap anyway
    s.hush.on = false; // nor listen: the microphone is opened from a tap
    // what no longer exists in the library (a sound removed since) is forgotten
    s.music.tracks = (s.music.tracks || []).filter((t) => this.items.get(t)?.kind === "music");
    s.music.levels = Object.fromEntries(Object.entries(s.music.levels || {}).filter(([t]) => this.items.has(t)));
    const cats = new Set(this.lib.sfx.map((i) => i.category));
    s.haunt.cats = (s.haunt.cats || []).filter((c) => cats.has(c));
    if (s.voice_langs != null && !Array.isArray(s.voice_langs)) s.voice_langs = null;
    return d;
  }

  save() {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => {
      try { localStorage.setItem(this.store, JSON.stringify(this.data)); } catch (e) { /* storage full / blocked */ }
    }, 300);
  }

  get s() { return this.data.settings; }
  w(k, ...a) { const v = WORDS[this.lang][k]; return typeof v === "function" ? v(...a) : v; }
  // the random mode's name in this theme ("Haunt mode"), for the history
  modeName() { return this.lib.words?.[this.lang]?.haunt || this.lib.words?.en?.haunt || this.w("mode"); }
  // spoken sounds in these languages are shown and picked; unset = the page's language
  voiceLangs() { return this.s.voice_langs ?? [this.lang]; }
  get me() { return "browser:" + this.deviceId; }

  // ----- the hass-like surface the card uses -----
  async subscribe(cb, msg) {
    this.deviceId = msg.device_id || "local";
    this.subs.add(cb);
    cb(this.stateMsg());
    return () => this.subs.delete(cb);
  }

  async callWS(msg) {
    const t = msg.type;
    if (t === "auth/sign_path") return { path: msg.path };
    if (t === "soundboard/library") return msg.theme === this.lib.id ? this.lib : null;
    if (t === "soundboard/settings") return this.updateSettings(msg.patch || {});
    if (t === "soundboard/music") {
      if (msg.action === "play") this.musicPlay(true);
      else if (msg.action === "stop") this.musicStop(true);
      else this.musicNext(msg.action === "prev" ? -1 : 1);
      return null;
    }
    if (t === "soundboard/queue") return this.queue(msg);
    if (t === "soundboard/hold") return this.hold(msg.on);
    if (t === "soundboard/hide") return this.setHidden(msg.theme, msg.ids, msg.hidden);
    if (t === "soundboard/mark") return this.setMarks(msg.theme, msg.ids, msg.fav, msg.down);
    if (t === "soundboard/undo") { if (!this.undo(msg.entry)) throw new Error("nothing to undo"); return null; }
    if (t === "soundboard/preset") return this.preset(msg);
    if (t === "soundboard/data") return this.dataOp(msg);
    if (t === "soundboard/stop_all") {
      this.queueStop(); this.musicStop(false); this.send({ cmd: "sfx_stop" });
      if (this.s.haunt.on) { this.s.haunt.on = false; this.hauntStop(); this.save(); }
      this.log(this.w("stop_all")); return null;
    }
    if (t === "soundboard/lang") { this.lang = msg.lang === "fr" ? "fr" : "en"; this.notify(); return null; }
    if (t === "soundboard/warm") return null; // no house speakers to keep connected here
    throw new Error(`unknown command ${t}`);
  }

  // ----- state -----
  notify() {
    if (this._nt) return;
    this._nt = setTimeout(() => {
      this._nt = null;
      this.version++;
      const m = this.stateMsg();
      for (const cb of this.subs) cb(m);
    }, 30);
  }

  send(cmd) { for (const cb of this.subs) cb({ type: "cmd", ...cmd }); }

  stateMsg() {
    const s = clone(this.s);
    s.voice_langs = this.voiceLangs();
    s.music.speakers = this.deviceId ? [this.me] : [];
    s.sfx.speakers = this.deviceId ? [this.me] : [];
    s.trim = {};
    const cur = this.qCurrent;
    const layers = [...this.layers.values()].map((la) => {
      const it = this.items.get(la.track);
      return { id: la.id, track: la.track, title: it?.title || "", gain: la.gain, duration: it?.duration || 0,
        started: la.t0, index: la.index, count: la.playlist.length };
    });
    return {
      type: "state",
      state: {
        version: this.version,
        server_time: now(),
        settings: s,
        // copies: the card updates its state optimistically before sending the command, and
        // must not write into ours (undo would then record the new value as the old one)
        hidden: clone({ [this.lib.id]: this.data.hidden[this.lib.id] || {} }),
        marks: clone({ [this.lib.id]: this.data.marks[this.lib.id] || {} }),
        presets: clone(this.data.presets),
        history: clone(this.data.history.slice(-HISTORY_SENT)),
        warm: false,
        outputs: this.deviceId ? [{ id: this.me, name: "This device", group: "outdoor", kind: "browser", available: true, ready: "ok" }] : [],
        themes: [{ id: this.lib.id, name: this.lib.name, name_fr: this.lib.name_fr, emoji: this.lib.emoji, accent: this.lib.accent,
          accent2: this.lib.accent2, look: this.lib.look, order: 1 }],
        music: { playing: this.mPlaying, mix: this.mMix, theme: this.lib.id, layers },
        queue: {
          running: !!this.qRun,
          items: this.qItems.map(({ _t, ...i }) => i),
          current: cur ? cur.uid : null,
          // held on a pause: it stands still, so its bar does too (the card stops the animation)
          current_started: cur && cur._t ? cur._t + (this.qHeld && this.qFreeze ? now() - this.qHeld : 0) : null,
          gap_until: this.qGapUntil > now() ? this.qGapUntil : null,
          held: !!this.qHeld,
        },
      },
    };
  }

  // ----- history -----
  log(text, undo) {
    const e = { id: uid(), t: Math.round(now() * 10) / 10, who: this.w("you"), text };
    if (undo) e.undo = undo;
    this.data.history.push(e);
    this.data.history.splice(0, Math.max(0, this.data.history.length - HISTORY_MAX));
    this.save();
    this.notify();
  }

  titles(ids) {
    const names = ids.slice(0, 3).map((i) => { const it = this.items.get(i); return (this.lang === "fr" && it?.title_fr) || it?.title || i.split("/").pop(); });
    return names.map((n) => `“${n}”`).join(", ") + (ids.length > 3 ? ` +${ids.length - 3}` : "");
  }

  undo(entryId) {
    const e = this.data.history.find((x) => x.id === entryId);
    if (!e || !e.undo || e.undone) return false;
    const u = e.undo;
    const hidden = (this.data.hidden[u.theme] ||= {});
    const marks = (this.data.marks[u.theme] ||= {});
    for (const [i, prev] of Object.entries(u.prev)) {
      if ("hidden" in prev) { if (prev.hidden == null) delete hidden[i]; else hidden[i] = prev.hidden; }
      if ("marks" in prev) { if (prev.marks && Object.keys(prev.marks).length) marks[i] = { ...prev.marks }; else delete marks[i]; }
    }
    e.undone = true;
    this.log(this.w("undid", e.text));
    return true;
  }

  setHidden(theme, ids, hide) {
    const h = (this.data.hidden[theme] ||= {});
    const prev = Object.fromEntries(ids.map((i) => [i, { hidden: i in h ? h[i] : null }]));
    for (const i of ids) {
      if (hide === !!this.items.get(i)?.default_hidden) delete h[i]; else h[i] = hide;
    }
    this.log(`${this.w(hide ? "hid" : "unhid")} ${this.titles(ids)}`, { theme, prev });
    return null;
  }

  // thumbs-down also hides the sound; clearing it puts it back to its default visibility
  setMarks(theme, ids, fav, down) {
    const marks = (this.data.marks[theme] ||= {});
    const hidden = (this.data.hidden[theme] ||= {});
    const prev = Object.fromEntries(ids.map((i) => [i, { marks: { ...(marks[i] || {}) }, hidden: i in hidden ? hidden[i] : null }]));
    for (const i of ids) {
      const m = { ...(marks[i] || {}) };
      if (fav != null) { if (fav) m.fav = true; else delete m.fav; }
      if (down != null) {
        if (down) { m.down = true; hidden[i] = true; } else { delete m.down; delete hidden[i]; }
      }
      if (Object.keys(m).length) marks[i] = m; else delete marks[i];
    }
    const what = this.w(fav != null ? (fav ? "fav" : "unfav") : (down ? "disliked" : "undisliked"));
    this.log(`${what} ${this.titles(ids)}`, { theme, prev });
    return null;
  }

  // ----- settings -----
  updateSettings(patch) {
    const s = this.s;
    const before = { mix: s.music.mix, sfxVol: s.sfx.volume };
    const p = clone(patch);
    delete p.theme; // one theme here
    if (p.music) delete p.music.speakers;
    if (p.sfx) delete p.sfx.speakers;
    delete p.trim;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, +v || 0));
    if (p.music) {
      if ("volume" in p.music) p.music.volume = clamp(p.music.volume, 0, 1);
      if (p.music.tracks) p.music.tracks = p.music.tracks.filter((t) => this.items.get(t)?.kind === "music");
      if (p.music.levels) for (const k in p.music.levels) p.music.levels[k] = clamp(p.music.levels[k], 0, 1.5);
    }
    if ("voice_langs" in p) p.voice_langs = Array.isArray(p.voice_langs) ? p.voice_langs.filter((l) => l === "en" || l === "fr") : null;
    if (p.hush) {
      if ("on" in p.hush) p.hush.on = !!p.hush.on && !!this.lib.hush;
      if ("sens" in p.hush) p.hush.sens = Math.round(clamp(p.hush.sens, 1, 10));
      if ("hold_s" in p.hush) p.hush.hold_s = Math.round(clamp(p.hush.hold_s, 3, 120));
    }
    if (p.haunt) {
      for (const k of ["min_s", "max_s"]) if (k in p.haunt) p.haunt[k] = clamp(p.haunt[k], 5, 1800);
      if (p.haunt.cats) p.haunt.cats = p.haunt.cats.filter((c) => typeof c === "string").slice(0, 60);
    }
    if (p.sfx) {
      if ("volume" in p.sfx) p.sfx.volume = clamp(p.sfx.volume, 0, 1);
      if ("gap" in p.sfx) p.sfx.gap = clamp(p.sfx.gap, 0, 120);
      if ("pause_s" in p.sfx) p.sfx.pause_s = clamp(p.sfx.pause_s, 1, 120);
    }
    const hushWas = s.hush.on;
    merge(s, p);
    this.save();
    if (p.hush && "on" in p.hush && p.hush.on !== hushWas) this.log(this.w("hush", p.hush.on));
    const mp = p.music || {};
    if ("mix" in mp && !!mp.mix !== !!before.mix) {
      this.log(this.w("mix", mp.mix));
      if (this.mPlaying) this.musicPlay(false);
    } else if (this.mPlaying) {
      if (this.mMix && mp.tracks) this.mixRetrack();
      if (this.mMix && mp.levels) {
        const ml = this.layers.get(MUSIC_LAYER);
        for (const [k, v] of Object.entries(mp.levels)) {
          const la = this.layers.get(k) || (ml?.track === k ? ml : null);
          if (la) la.gain = v;
        }
      }
      if ("volume" in mp || mp.levels) this.send({ cmd: "music_volume", layers: this.gains() });
    }
    if (p.sfx && "volume" in p.sfx && this.qCurrent?.type === "sound") {
      this.send({ cmd: "sfx_volume", volume: taper(s.sfx.volume) * (this.items.get(this.qCurrent.id)?.gain || 1) });
    }
    if (p.haunt && "on" in p.haunt) {
      this.log(this.w("haunt", p.haunt.on, this.modeName()));
      if (p.haunt.on) this.hauntStart(); else this.hauntStop();
    }
    this.notify();
    return null;
  }

  // ----- background -----
  gains() {
    const g = {};
    for (const la of this.layers.values()) g[la.id] = taper(this.s.music.volume) * taper(la.gain) * (this.items.get(la.track)?.gain || 1);
    const top = Math.max(1, ...Object.values(g));
    // an <audio> element stops at 1: keep the balance between layers, give up only the boost
    for (const k in g) g[k] = Math.round((g[k] / top) * 1000) / 1000;
    return g;
  }

  level(track) { return this.s.music.levels[track] ?? DEFAULT_LEVEL; }

  // "music" (a carol) or "ambience" (a fire, the wind); a track that says nothing is an ambience
  isMusic(track) { return this.items.get(track)?.group === "music"; }

  musicPlay(byUser) {
    const tracks = this.s.music.tracks.filter((t) => this.items.has(t));
    if (!tracks.length) return;
    this.musicStop(false);
    this.mMix = !!this.s.music.mix;
    this.mPlaying = true;
    if (this.mMix) {
      const music = tracks.filter((t) => this.isMusic(t));
      if (music.length) this.layers.set(MUSIC_LAYER, { id: MUSIC_LAYER, playlist: music, index: 0, gain: this.level(music[0]) });
      for (const t of tracks) if (!this.isMusic(t)) this.layers.set(t, { id: t, playlist: [t], index: 0, gain: this.level(t) });
    } else this.layers.set("main", { id: "main", playlist: tracks, index: 0, gain: 1 });
    for (const la of this.layers.values()) this.startLayer(la);
    if (byUser) this.log(this.w("started", this.mMix, this.titles(tracks)));
    this.notify();
  }

  startLayer(la) {
    la.track = la.playlist[la.index % la.playlist.length];
    la.t0 = now();
    clearTimeout(la.timer);
    const it = this.items.get(la.track);
    if (!it) { this.removeLayer(la.id); return; }
    if (la.id === MUSIC_LAYER) la.gain = this.level(la.track); // each piece at its own level
    la.timer = setTimeout(() => this.layerNext(la, 1), Math.max(1, it.duration) * 1000);
    // a layer of one track loops by itself in the player; a playlist moves on at the end
    this.send({ cmd: "music", layer: la.id, url: it.url, offset: 0, volume: this.gains()[la.id] ?? 1, title: it.title,
      loop: this.mMix && !!this.s.music.loop && la.playlist.length === 1 });
    this.send({ cmd: "music_volume", layers: this.gains() });
  }

  layerNext(la, step) {
    if (!this.mPlaying || this.layers.get(la.id) !== la) return;
    let nxt = la.index + step;
    if (nxt >= la.playlist.length || nxt < 0) {
      if (!this.s.music.loop) { this.removeLayer(la.id); return; }
      nxt = (nxt + la.playlist.length) % la.playlist.length;
    }
    la.index = nxt;
    this.startLayer(la);
    this.notify();
  }

  musicNext(step) {
    const la = this.layers.get(this.mMix ? MUSIC_LAYER : "main");
    if (this.mPlaying && la) this.layerNext(la, step);
  }

  removeLayer(lid) {
    const la = this.layers.get(lid);
    if (!la) return;
    clearTimeout(la.timer);
    this.layers.delete(lid);
    this.send({ cmd: "music_stop", layer: lid });
    if (!this.layers.size) this.musicStop(false);
    this.notify();
  }

  // mixing: ticking / unticking an ambience adds / removes its layer live; ticked music joins
  // the music layer's playlist (unticking the piece playing moves on to the next ticked one)
  mixRetrack() {
    const ticked = this.s.music.tracks.filter((t) => this.items.has(t));
    const music = ticked.filter((t) => this.isMusic(t));
    const amb = ticked.filter((t) => !this.isMusic(t));
    for (const lid of [...this.layers.keys()]) if (lid !== MUSIC_LAYER && !amb.includes(lid)) this.removeLayer(lid);
    if (!music.length) this.removeLayer(MUSIC_LAYER);
    if (!this.mPlaying) return;
    const ml = this.layers.get(MUSIC_LAYER);
    if (ml) {
      const i = music.indexOf(ml.track);
      ml.playlist = music;
      if (i >= 0) ml.index = i;
      else { ml.index = 0; this.startLayer(ml); }
    } else if (music.length) {
      const la = { id: MUSIC_LAYER, playlist: music, index: 0, gain: this.level(music[0]) };
      this.layers.set(MUSIC_LAYER, la);
      this.startLayer(la);
    }
    for (const t of amb) {
      if (!this.layers.has(t)) {
        const la = { id: t, playlist: [t], index: 0, gain: this.level(t) };
        this.layers.set(t, la);
        this.startLayer(la);
      }
    }
    this.notify();
  }

  musicStop(byUser) {
    const was = this.mPlaying;
    this.mPlaying = false;
    for (const la of this.layers.values()) clearTimeout(la.timer);
    this.layers.clear();
    if (was) this.send({ cmd: "music_stop" });
    if (byUser && was) this.log(this.w("stopped"));
    this.notify();
  }

  // ----- effect queue -----
  queue(msg) {
    const a = msg.action;
    if (a === "add") this.queueAdd(msg.items || []);
    else if (a === "remove") {
      if (this.qCurrent?.uid === msg.uid) this.queueSkip();
      this.qItems = this.qItems.filter((i) => i.uid !== msg.uid);
    } else if (a === "clear") { this.queueStop(); this.qItems = []; this.log(this.w("cleared")); }
    else if (a === "play" || a === "replay") this.queuePlay(a === "replay");
    else if (a === "stop") this.queueStop();
    else if (a === "skip") this.queueSkip();
    this.notify();
    return null;
  }

  queueAdd(entries, autoplay) {
    for (const e of entries.slice(0, 50)) {
      if (this.qItems.length >= MAX_QUEUE) {
        const done = this.qItems.findIndex((i) => i.status === "done");
        if (done < 0) break;
        this.qItems.splice(done, 1);
      }
      if (e.type === "pause") {
        this.qItems.push({ uid: uid(), type: "pause", title: "Pause", duration: Math.min(120, Math.max(0.5, +e.duration || this.s.sfx.pause_s)),
          status: "pending", speakers: null, volume: null });
        continue;
      }
      const it = this.items.get(e.id);
      if (!it || it.kind !== "sfx") continue;
      this.qItems.push({ uid: uid(), type: "sound", theme: this.lib.id, id: it.id, title: it.title, category: it.category,
        duration: it.duration, speakers: null, volume: null, status: "pending" });
    }
    if (!this.qRun && (autoplay ?? this.s.sfx.autoplay)) this.queuePlay(false);
  }

  queuePlay(replay) {
    if (replay || !this.qItems.some((i) => i.status === "pending")) for (const i of this.qItems) i.status = "pending";
    if (!this.qItems.length || this.qRun) return;
    const token = {};
    this.qRun = token;
    this.runQueue(token);
    this.notify();
  }

  // still: a pause or the gap, which stands still while the queue is held (a sound plays on, faded)
  wait(sec, still) {
    return new Promise((res) => {
      let left = Math.max(0, sec) * 1000, t = null, t0 = 0;
      const go = () => { t0 = Date.now(); t = setTimeout(end, left); };
      const end = () => { clearTimeout(t); if (this.qFreeze === freeze) this.qFreeze = null; res(); };
      const freeze = (held) => {
        if (held && t) { clearTimeout(t); t = null; left = Math.max(0, left - (Date.now() - t0)); }
        else if (!held && !t) go();
      };
      this.qWake = end;
      if (still) this.qFreeze = freeze;
      if (!(still && this.qHeld)) go();
    });
  }

  // The card's hush (fade everything at a noise, Christmas): while it holds, the queue starts
  // nothing new and its pauses stand still, so a long scene (the elves at night) picks up where
  // it froze instead of running on unheard. The sound playing at the noise ends faded.
  hold(on) {
    on = !!on;
    if (on === !!this.qHeld) return null;
    if (on) this.qHeld = now();
    else {
      const dt = now() - this.qHeld;
      this.qHeld = 0;
      if (this.qFreeze) { // a pause (or the gap) stood still: so does its progress
        if (this.qCurrent?._t) this.qCurrent._t += dt;
        if (this.qGapUntil) this.qGapUntil += dt;
      }
      this.qUnhold?.();
    }
    this.qFreeze?.(on);
    this.notify();
    return null;
  }

  unheld() {
    return new Promise((res) => {
      const end = () => { this.qUnhold = null; res(); };
      this.qUnhold = end;
      this.qWake = end; // stop / skip
    });
  }

  async runQueue(token) {
    try {
      while (this.qRun === token) {
        let item = this.qItems.find((i) => i.status === "pending");
        if (!item) {
          if (this.s.sfx.loop && this.qItems.some((i) => i.type === "sound")) {
            for (const i of this.qItems) i.status = "pending";
            continue;
          }
          break;
        }
        if (this.qHeld) { await this.unheld(); continue; }
        await this.playItem(item, token);
        if (this.qRun !== token) break;
        const more = this.qItems.some((i) => i.status === "pending") || this.s.sfx.loop;
        const gap = +this.s.sfx.gap || 0;
        if (gap > 0 && more) {
          this.qGapUntil = now() + gap;
          this.notify();
          await this.wait(gap, true); // a skip during a gap just ends the gap
          this.qGapUntil = 0;
        }
      }
    } finally {
      if (this.qRun === token) this.qRun = null;
      this.qCurrent = null;
      this.qGapUntil = 0;
      this.notify();
    }
  }

  async playItem(item, token) {
    item.status = "playing";
    item._t = now();
    this.qCurrent = item;
    this.notify();
    if (item.type === "pause") {
      await this.wait(item.duration, true);
    } else {
      const it = this.items.get(item.id);
      if (it) {
        this.send({ cmd: "sfx", url: it.url, volume: taper(this.s.sfx.volume) * (it.gain || 1), title: it.title });
        await this.wait(it.duration + 0.15);
      } else {
        item.status = "error";
      }
    }
    if (item.status === "playing") item.status = "done";
    delete item._t;
    if (this.qRun === token || !this.qRun) this.qCurrent = null;
  }

  queueSkip() {
    this.send({ cmd: "sfx_stop" });
    this.qWake?.();
  }

  queueStop() {
    this.send({ cmd: "sfx_stop" });
    this.qRun = null;
    this.qWake?.();
    this.qCurrent = null;
    this.notify();
  }

  // ----- haunt mode: a random scare every min_s..max_s seconds, by itself -----
  hauntStart() {
    clearTimeout(this.hauntT);
    const h = this.s.haunt;
    const [lo, hi] = [Math.min(h.min_s, h.max_s), Math.max(h.min_s, h.max_s)];
    this.hauntT = setTimeout(() => this.hauntTick(), (lo + Math.random() * (hi - lo)) * 1000);
  }

  hauntStop() { clearTimeout(this.hauntT); this.hauntT = null; }

  hauntTick() {
    if (!this.s.haunt.on) return;
    // skipped while sounds still wait in the queue, so it never piles up
    if (!this.qItems.some((i) => i.status === "pending")) {
      const it = this.pick();
      if (it) this.queueAdd([{ type: "sound", id: it.id }], true);
      this.notify();
    }
    this.hauntStart();
  }

  pick() {
    const h = this.s.haunt, theme = this.lib.id;
    // categories of this theme only (a list saved under another one would match nothing)
    const cats = new Set((h.cats || []).filter((c) => this.lib.sfx.some((i) => i.category === c)));
    const langs = this.voiceLangs();
    const hidden = this.data.hidden[theme] || {}, marks = this.data.marks[theme] || {};
    const pool = this.lib.sfx.filter((i) => i.duration <= 30 && !(i.id in hidden ? hidden[i.id] : i.default_hidden)
      && (!i.lang || !langs.length || langs.includes(i.lang))
      && (!cats.size || cats.has(i.category)) && (!h.favs || marks[i.id]?.fav));
    this.recent ||= [];
    const fresh = pool.filter((i) => !this.recent.includes(i.id));
    const list = fresh.length ? fresh : pool;
    if (!list.length) return null;
    const it = list[Math.floor(Math.random() * list.length)];
    this.recent = this.recent.concat(it.id).slice(-Math.max(1, Math.min(8, Math.floor(pool.length / 2))));
    return it;
  }

  // ----- presets -----
  preset(msg) {
    if (msg.action === "save") {
      const name = String(msg.name || "").trim().slice(0, 40);
      if (!name) throw new Error("name required");
      const m = this.s.music;
      const p = { id: uid().slice(0, 8), name, theme: this.lib.id,
        music: clone({ volume: m.volume, tracks: m.tracks, mix: m.mix, levels: m.levels, loop: m.loop, speakers: [] }),
        sfx: { volume: this.s.sfx.volume, speakers: [] }, trim: {} };
      this.data.presets = this.data.presets.filter((x) => x.name !== name).concat(p).slice(-PRESETS_MAX);
      this.log(this.w("saved", name));
    } else {
      const p = this.data.presets.find((x) => x.id === msg.preset);
      if (!p) throw new Error("no such preset");
      this.data.presets = this.data.presets.filter((x) => x !== p);
      this.log(this.w("deleted", p.name));
    }
    this.save();
    return null;
  }

  // ----- export / import / reset (the card's "Your data") -----
  dataOp(msg) {
    // "halloween-soundboard": what exports said before the soundboard had more than one theme
    if (msg.action === "export") return { app: "soundboard", theme: this.lib.id, format: 1, exported: new Date().toISOString(), ...clone(this.data) };
    if (msg.action === "import") {
      const d = msg.data;
      if (!isObj(d) || !["soundboard", "halloween-soundboard"].includes(d.app)) throw new Error("not a soundboard export");
      this.queueStop();
      this.musicStop(false);
      this.data = this.normalise(d);
    } else if (msg.action === "reset") {
      this.queueStop();
      this.musicStop(false);
      this.qItems = [];
      this.data = this.normalise({});
    } else {
      throw new Error("unknown data action");
    }
    try { localStorage.setItem(this.store, JSON.stringify(this.data)); } catch (e) { /* blocked */ }
    this.notify();
    return null;
  }
}
