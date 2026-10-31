// soundboard-local.js: the soundboard's engine, running in the browser.
//
// The card (soundboard-card.js) is the same one that runs in Home Assistant, where a server-side
// engine drives the house speakers over a websocket. Here this module answers the same messages
// (callWS / subscribeMessage, see AGENTS.md "Card <-> engine contract"), with one speaker: the
// page itself. Everything you change (settings, favourites, hidden sounds, presets, history) is
// kept in this browser's localStorage.

const STORE = "soundboard.local.v1";
const HISTORY_MAX = 200;
const HISTORY_SENT = 60;
const PRESETS_MAX = 30;
const MAX_QUEUE = 150;
const DEFAULT_LEVEL = 1;

const DEFAULTS = {
  theme: "halloween",
  music: { tracks: [], volume: 0.6, loop: true, mix: false, levels: {} },
  sfx: { volume: 0.8, gap: 0, loop: false, autoplay: true, pause_s: 5 },
  haunt: { on: false, min_s: 20, max_s: 90, cats: [], favs: false },
};

// the history's words (the card translates everything else)
const WORDS = {
  en: { you: "You", undid: (t) => `Undid: ${t}`, hid: "Hid", unhid: "Unhid", fav: "Favourited", unfav: "Unfavourited",
    disliked: "Disliked", undisliked: "Un-disliked", mix: (on) => `Background mixing ${on ? "on" : "off"}`,
    started: (mix, t) => `Started background${mix ? " mix" : ""}: ${t}`, stopped: "Stopped background", cleared: "Cleared the effects queue",
    saved: (n) => `Saved preset “${n}”`, deleted: (n) => `Deleted preset “${n}”`, haunt: (on) => `Haunt mode ${on ? "on" : "off"}`, stop_all: "STOP ALL" },
  fr: { you: "Vous", undid: (t) => `Annulé : ${t}`, hid: "Masqué", unhid: "Affiché", fav: "Favori", unfav: "Retiré des favoris",
    disliked: "Pas aimé", undisliked: "Plus « pas aimé »", mix: (on) => `Mélange d'ambiances ${on ? "activé" : "désactivé"}`,
    started: (mix, t) => `Ambiance lancée${mix ? " (mélange)" : ""} : ${t}`, stopped: "Ambiance arrêtée", cleared: "File d'effets vidée",
    saved: (n) => `Préréglage « ${n} » enregistré`, deleted: (n) => `Préréglage « ${n} » supprimé`, haunt: (on) => `Mode hanté ${on ? "activé" : "désactivé"}`, stop_all: "TOUT ARRÊTER" },
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
  constructor(library, lang = "en") {
    this.lang = lang === "fr" ? "fr" : "en";
    this.lib = library; // theme dict: {id, name, emoji, accent, accent2, categories, sfx: [...], music: [...]}
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
    this.connection = { subscribeMessage: (cb, msg) => this.subscribe(cb, msg) };
  }

  // ----- persistence -----
  load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { /* private mode, corrupt */ }
    return this.normalise(saved);
  }

  normalise(saved) {
    const d = {
      settings: merge(clone(DEFAULTS), isObj(saved.settings) ? saved.settings : {}),
      hidden: isObj(saved.hidden) ? saved.hidden : {},
      marks: isObj(saved.marks) ? saved.marks : {},
      presets: Array.isArray(saved.presets) ? saved.presets.slice(-PRESETS_MAX) : [],
      history: Array.isArray(saved.history) ? saved.history.slice(-HISTORY_MAX) : [],
    };
    d.settings.theme = this.lib.id;
    d.settings.haunt.on = false; // a reloaded page can't play before a tap anyway
    return d;
  }

  save() {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => {
      try { localStorage.setItem(STORE, JSON.stringify(this.data)); } catch (e) { /* storage full / blocked */ }
    }, 300);
  }

  get s() { return this.data.settings; }
  w(k, ...a) { const v = WORDS[this.lang][k]; return typeof v === "function" ? v(...a) : v; }
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
    if (t === "soundboard/lang") { this.lang = msg.lang === "fr" ? "fr" : "en"; return null; }
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
        themes: [{ id: this.lib.id, name: this.lib.name, emoji: this.lib.emoji, accent: this.lib.accent, accent2: this.lib.accent2, order: 1 }],
        music: { playing: this.mPlaying, mix: this.mMix, theme: this.lib.id, layers },
        queue: {
          running: !!this.qRun,
          items: this.qItems.map(({ _t, ...i }) => i),
          current: cur ? cur.uid : null,
          current_started: cur && cur._t ? cur._t : null,
          gap_until: this.qGapUntil > now() ? this.qGapUntil : null,
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
    if (p.haunt) {
      for (const k of ["min_s", "max_s"]) if (k in p.haunt) p.haunt[k] = clamp(p.haunt[k], 5, 1800);
      if (p.haunt.cats) p.haunt.cats = p.haunt.cats.filter((c) => typeof c === "string").slice(0, 60);
    }
    if (p.sfx) {
      if ("volume" in p.sfx) p.sfx.volume = clamp(p.sfx.volume, 0, 1);
      if ("gap" in p.sfx) p.sfx.gap = clamp(p.sfx.gap, 0, 120);
      if ("pause_s" in p.sfx) p.sfx.pause_s = clamp(p.sfx.pause_s, 1, 120);
    }
    merge(s, p);
    this.save();
    const mp = p.music || {};
    if ("mix" in mp && !!mp.mix !== !!before.mix) {
      this.log(this.w("mix", mp.mix));
      if (this.mPlaying) this.musicPlay(false);
    } else if (this.mPlaying) {
      if (this.mMix && mp.tracks) this.mixRetrack();
      if (this.mMix && mp.levels) for (const [k, v] of Object.entries(mp.levels)) { const la = this.layers.get(k); if (la) la.gain = v; }
      if ("volume" in mp || mp.levels) this.send({ cmd: "music_volume", layers: this.gains() });
    }
    if (p.sfx && "volume" in p.sfx && this.qCurrent?.type === "sound") {
      this.send({ cmd: "sfx_volume", volume: taper(s.sfx.volume) * (this.items.get(this.qCurrent.id)?.gain || 1) });
    }
    if (p.haunt && "on" in p.haunt) {
      this.log(this.w("haunt", p.haunt.on));
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

  musicPlay(byUser) {
    const tracks = this.s.music.tracks.filter((t) => this.items.has(t));
    if (!tracks.length) return;
    this.musicStop(false);
    this.mMix = !!this.s.music.mix;
    this.mPlaying = true;
    if (this.mMix) for (const t of tracks) this.layers.set(t, { id: t, playlist: [t], index: 0, gain: this.level(t) });
    else this.layers.set("main", { id: "main", playlist: tracks, index: 0, gain: 1 });
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
    la.timer = setTimeout(() => this.layerNext(la, 1), Math.max(1, it.duration) * 1000);
    this.send({ cmd: "music", layer: la.id, url: it.url, offset: 0, volume: this.gains()[la.id] ?? 1, title: it.title,
      loop: this.mMix && !!this.s.music.loop });
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
    const la = this.layers.get("main");
    if (this.mPlaying && !this.mMix && la) this.layerNext(la, step);
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

  // mixing: ticking / unticking a track adds / removes its layer live
  mixRetrack() {
    const want = this.s.music.tracks.filter((t) => this.items.has(t));
    for (const lid of [...this.layers.keys()]) if (!want.includes(lid)) this.removeLayer(lid);
    if (!this.mPlaying) return;
    for (const t of want) {
      if (!this.layers.has(t)) {
        const la = { id: t, playlist: [t], index: 0, gain: this.level(t) };
        this.layers.set(t, la);
        this.startLayer(la);
      }
    }
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

  wait(sec) {
    return new Promise((res) => {
      const t = setTimeout(res, Math.max(0, sec) * 1000);
      this.qWake = () => { clearTimeout(t); res(); };
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
        await this.playItem(item, token);
        if (this.qRun !== token) break;
        const more = this.qItems.some((i) => i.status === "pending") || this.s.sfx.loop;
        const gap = +this.s.sfx.gap || 0;
        if (gap > 0 && more) {
          this.qGapUntil = now() + gap;
          this.notify();
          await this.wait(gap); // a skip during a gap just ends the gap
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
      await this.wait(item.duration);
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
    const cats = new Set(h.cats || []);
    const hidden = this.data.hidden[theme] || {}, marks = this.data.marks[theme] || {};
    const pool = this.lib.sfx.filter((i) => i.duration <= 30 && !(i.id in hidden ? hidden[i.id] : i.default_hidden)
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
    if (msg.action === "export") return { app: "halloween-soundboard", format: 1, exported: new Date().toISOString(), ...clone(this.data) };
    if (msg.action === "import") {
      const d = msg.data;
      if (!isObj(d) || d.app !== "halloween-soundboard") throw new Error("not a soundboard export");
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
    try { localStorage.setItem(STORE, JSON.stringify(this.data)); } catch (e) { /* blocked */ }
    this.notify();
    return null;
  }
}
