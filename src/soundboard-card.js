// Soundboard card: themed background music + a sound-effect queue across the house speakers.
// Served by the soundboard integration (custom_components/soundboard), which owns all playback;
// this file is UI plus the "This device" speaker (a phone/tablet, e.g. paired to a Bluetooth speaker).

const CAT_EMOJI = {
  screams: "😱", crying: "😢", laughs: "😈", "creepy-kids": "🧸", ghosts: "👻", voices: "🗣️",
  monsters: "👹", zombies: "🧟", werewolves: "🐺", "vampires-bats": "🦇", witches: "🧙",
  animals: "🐈‍⬛", house: "🚪", stingers: "🎻", "weather-bells": "🔔", gore: "🔪", lab: "⚡",
  "heartbeat-breath": "💓", ambience: "🌫️", other: "🎵",
};
// The card's fonts sit next to it (www/fonts/, SIL OFL); @font-face only works in the document.
const FONT_BASE = new URL("fonts/", import.meta.url).href;
if (!document.getElementById("soundboard-fonts")) {
  const f = document.createElement("style");
  f.id = "soundboard-fonts";
  f.textContent = `@font-face{font-family:"SB Display";src:url(${FONT_BASE}pirata-one.woff2) format("woff2");font-display:swap}
@font-face{font-family:"SB Body";src:url(${FONT_BASE}bricolage-grotesque.woff2) format("woff2");font-weight:200 800;font-display:swap}`;
  document.head.appendChild(f);
}
const KIND_ICON = { camera: "mdi:cctv", cast: "mdi:speaker", sonos: "mdi:soundbar", browser: "mdi:cellphone-sound" };
const LS = (k, v) => {
  try {
    if (v === undefined) return JSON.parse(localStorage.getItem("soundboard." + k));
    localStorage.setItem("soundboard." + k, JSON.stringify(v));
  } catch (e) { return undefined; }
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clamp01 = (v) => Math.min(1, Math.max(0, v));
// a few samples of silence, played from a tap to unlock each <audio> on mobile
const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA";
const fmtDur = (s) => {
  s = Math.max(0, Math.round(s || 0));
  if (s >= 3600) return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
  if (s >= 60) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return `${s}s`;
};

// ----- words (en, fr). Sound titles stay as the library has them. -----
const I18N = {
  en: {
    sounds_n: (n) => `${n} sounds`, soundboard: "Soundboard",
    tab_speakers: "🔊 Speakers", tab_volume: "🎚️ Volume", tab_sounds: "Sounds", pick_play: "pick &amp; play", on: "on",
    stop_all: "Stop all", stop_all_t: "Stop everything, everywhere (haunt mode and motion scares too)",
    lock_house: "🔈 Tap here to enable sound on this device", lock_public: "🕯️ Tap anywhere to wake the dead (turns the sound on)",
    sfx: "💀 Sound effects", bg: "🎼 Background", hist: "🕯️ History",
    playing: "▶ playing", queued_n: (n) => `${n} queued`, mixed_n: (n) => `${n} mixed`,
    show_hidden: "Show hidden", show_hidden_t: "Hidden ones include those marked for deletion (thumbs down)",
    level_t: "100 % = the background volume; up to 150 % to bring a quiet one forward",
    no_tracks: "No background tracks in this theme yet.", tick_tracks: "Tick one or more tracks below.",
    restart: "Restart", play: "Play", stop: "Stop", next_track: "Next track", loop: "Loop", mix: "Mix",
    mix_t: "Play every ticked track at once, each with its own level. While it plays, tick or untick a track to add or remove it.",
    n_mixed: (n) => `${n} mixed`, n_tracks: (n) => `${n} tracks`,
    undone: "undone", undo: "Undo", hist_empty: "Nothing yet. Hiding, favourites, marks and playback show up here; hide / favourite / mark can be undone.",
    presets: "Presets", apply: "Apply", save_current: "＋ Save current", save_current_t: "Save what is ticked now (speakers, volumes, background tracks and levels) under a name",
    preset_eg: "e.g. “Porch: cameras + storm at 60 %”", delete_preset: (n) => `Delete preset ${n}`,
    background: "Background", effects: "Effects", volume_of: (n) => `${n} volume`,
    hint_public: "Your phone or computer's own volume sets the maximum; these balance the background against the effects.",
    hint_house: "100 % = the ticked speakers at full power. Speakers are turned all the way up while the soundboard uses them, the sliders do the rest, and they get their own volume back afterwards.",
    your_data: "Your data", data_hint: "Favourites, hidden sounds, presets and settings stay in this browser only.",
    export: "Export", import: "Import", reset: "Reset", offline: "Make it work offline", offline_t: "Downloads every sound so the soundboard works without a connection (install it as an app from your browser menu).",
    this_device: "This device", this_device_t: (n) => `${n}: plays on this phone/tablet (pair it with a Bluetooth speaker). Keep this page open.`,
    speakers: "Speakers", level: "Level", level_t2: "This speaker's own level: lower a speaker that is louder than the others",
    devices: "", outdoor: "Outdoor", indoor: "Indoor", all: "all", none: "none", on_x: (a, b) => `${a} on ${b}`, level_of: (n) => `${n} level`,
    instant: "Instant speakers", instant_t: "Keeps the selected camera and Cast speakers connected so effects start right away instead of after ~10 s. Turns itself off after 6 h. Other announcements on a camera still take over.",
    connecting_n: (n) => `connecting ${n}…`, ready_n: (n) => `${n} ready`, off: "off",
    p_summary: (a, b, c, d, n, mix) => [`🎼 ${a} speakers ${b}%`, `💀 ${c} speakers ${d}%`, n ? `${n} track${n > 1 ? "s" : ""}${mix ? " mixed" : ""}` : ""].filter(Boolean).join(" · "),
    preset_applied: (n) => `Preset “${n}” applied`, volume: "Volume", n_speakers: (n) => `${n} speaker${n > 1 ? "s" : ""}`, no_speaker: "No speaker ticked yet", change: "change",
    replay_all: "Replay all", play_n: (n) => `Play ${n}`, skip: "Skip", clear: "Clear", clear_t: "Clear the queue",
    q_options: "Queue options", plays_on_tap: "plays on tap", build_then_play: "build then Play", gap_s: (n) => `${n}s gap`,
    play_on_tap: "Play on tap", add_pause: "+ Pause", shorter: "Shorter pause", longer: "Longer pause", gap: "Gap between sounds",
    q_empty_tap: "Tap a sound to play it right away; tap more to line them up.", q_empty_build: "Tap sounds to build a sequence, then press Play.",
    waiting: "Waiting for every speaker to be ready, so they start together… ", pinned: (n) => ` → pinned to ${n} speaker(s)`, remove: "remove", gapw: "gap",
    summoning: "Summoning the sounds…", search_n: (n) => `Search ${n} sounds`, search: "Search sounds", tap_does: "What a tap does",
    mode_play: "Play", mode_preview: "Preview here", mode_play_t: "A tap plays it on the speakers (or lines it up)", mode_preview_t: "A tap only plays it here, for you",
    all_c: "All", favorites: "Favorites", no_match: "No sounds match.", queued: "queued",
    fav_add: "Favorite", fav_rm: "Remove from favorites", down_rm: "Unmark (keep it)", down_add_pub: "Dislike (also hides it)", down_add: "Mark for deletion (also hides it)",
    hide: "Hide", unhide: "Unhide", aim: "Play now on chosen speakers", aim_title: (t) => `Play “${t}” now on…`,
    aim_hint: "Not queued: it plays at once on these speakers, mixed over whatever they are playing.", play_now: "Play now", cancel: "Cancel",
    preset_name: "Name this preset (what plays where, volumes, background tracks):", preset_del: (n) => `Delete the preset “${n}”?`,
    reset_q: "Forget every favourite, hidden sound, preset and setting stored in this browser?", reset_done: "Back to a fresh soundboard",
    imported: "Imported", import_failed: (e) => `Import failed: ${e}`, tick_first: "Tick at least one speaker for effects first (Speakers tab)",
    haunt: "👻 Haunt mode", haunt_hint: (a, b) => `A random scare every ${a} to ${b} s, by itself.`, haunt_opts: "Haunt options",
    haunt_every: "Every", haunt_to: "to", haunt_from: "Pick from", favs_only: "♥ Favourites only", all_cats: "All categories",
    motion: "🏃 Motion scares", motion_hint: "When a camera sees a person, it plays a random scare (from the haunt pool) on that camera's speaker.",
    motion_cool: "At most once per camera every", cameras: "Cameras", all_cams: "all",
  },
  fr: {
    sounds_n: (n) => `${n} sons`, soundboard: "Table de sons",
    tab_speakers: "🔊 Enceintes", tab_volume: "🎚️ Volume", tab_sounds: "Sons", pick_play: "choisir &amp; jouer", on: "en cours",
    stop_all: "Tout arrêter", stop_all_t: "Tout arrêter, partout (mode hanté et frayeurs au mouvement aussi)",
    lock_house: "🔈 Touchez ici pour activer le son sur cet appareil", lock_public: "🕯️ Touchez n'importe où pour réveiller les morts (active le son)",
    sfx: "💀 Effets sonores", bg: "🎼 Ambiance", hist: "🕯️ Historique",
    playing: "▶ en cours", queued_n: (n) => `${n} en attente`, mixed_n: (n) => `${n} mélangées`,
    show_hidden: "Voir les masqués", show_hidden_t: "Les masqués incluent ceux marqués pour suppression (pouce en bas)",
    level_t: "100 % = le volume d'ambiance ; jusqu'à 150 % pour faire ressortir une piste discrète",
    no_tracks: "Pas encore de pistes d'ambiance dans ce thème.", tick_tracks: "Cochez une ou plusieurs pistes ci-dessous.",
    restart: "Relancer", play: "Jouer", stop: "Arrêter", next_track: "Piste suivante", loop: "Boucle", mix: "Mélange",
    mix_t: "Joue toutes les pistes cochées en même temps, chacune à son niveau. Pendant la lecture, cochez ou décochez pour ajouter ou retirer une piste.",
    n_mixed: (n) => `${n} mélangées`, n_tracks: (n) => `${n} pistes`,
    undone: "annulé", undo: "Annuler", hist_empty: "Rien pour l'instant. Masquages, favoris, marques et lectures apparaissent ici ; masquer / favori / marque peuvent être annulés.",
    presets: "Préréglages", apply: "Appliquer", save_current: "＋ Enregistrer", save_current_t: "Enregistre ce qui est coché (enceintes, volumes, pistes d'ambiance et niveaux) sous un nom",
    preset_eg: "ex. « Entrée : caméras + orage à 60 % »", delete_preset: (n) => `Supprimer le préréglage ${n}`,
    background: "Ambiance", effects: "Effets", volume_of: (n) => `Volume ${n}`,
    hint_public: "Le volume de votre téléphone ou ordinateur fixe le maximum ; ces curseurs équilibrent l'ambiance et les effets.",
    hint_house: "100 % = les enceintes cochées à pleine puissance. Elles sont montées au maximum pendant que la table de sons les utilise, les curseurs font le reste, puis elles retrouvent leur volume.",
    your_data: "Vos données", data_hint: "Favoris, sons masqués, préréglages et réglages restent uniquement dans ce navigateur.",
    export: "Exporter", import: "Importer", reset: "Réinitialiser", offline: "Utiliser hors ligne", offline_t: "Télécharge tous les sons pour que la table fonctionne sans connexion (installez-la comme une appli depuis le menu du navigateur).",
    this_device: "Cet appareil", this_device_t: (n) => `${n} : joue sur ce téléphone/cette tablette (reliez-le à une enceinte Bluetooth). Gardez cette page ouverte.`,
    speakers: "Enceintes", level: "Niveau", level_t2: "Le niveau propre de cette enceinte : baissez celle qui est plus forte que les autres",
    devices: "", outdoor: "Extérieur", indoor: "Intérieur", all: "toutes", none: "aucune", on_x: (a, b) => `${a} sur ${b}`, level_of: (n) => `Niveau ${n}`,
    instant: "Enceintes instantanées", instant_t: "Garde les caméras et enceintes Cast sélectionnées connectées pour que les effets démarrent tout de suite au lieu d'environ 10 s. S'éteint après 6 h. Les autres annonces sur une caméra restent prioritaires.",
    connecting_n: (n) => `connexion ${n}…`, ready_n: (n) => `${n} prêtes`, off: "éteint",
    p_summary: (a, b, c, d, n, mix) => [`🎼 ${a} enceintes ${b} %`, `💀 ${c} enceintes ${d} %`, n ? `${n} piste${n > 1 ? "s" : ""}${mix ? " mélangées" : ""}` : ""].filter(Boolean).join(" · "),
    preset_applied: (n) => `Préréglage « ${n} » appliqué`, volume: "Volume", n_speakers: (n) => `${n} enceinte${n > 1 ? "s" : ""}`, no_speaker: "Aucune enceinte cochée", change: "changer",
    replay_all: "Tout rejouer", play_n: (n) => `Jouer ${n}`, skip: "Passer", clear: "Vider", clear_t: "Vider la file",
    q_options: "Options de la file", plays_on_tap: "joue au toucher", build_then_play: "composer puis Jouer", gap_s: (n) => `${n} s d'écart`,
    play_on_tap: "Jouer au toucher", add_pause: "+ Pause", shorter: "Pause plus courte", longer: "Pause plus longue", gap: "Écart entre les sons",
    q_empty_tap: "Touchez un son pour le jouer tout de suite ; touchez-en d'autres pour les enchaîner.", q_empty_build: "Touchez des sons pour composer une séquence, puis Jouer.",
    waiting: "En attente que toutes les enceintes soient prêtes, pour démarrer ensemble… ", pinned: (n) => ` → réservé à ${n} enceinte(s)`, remove: "retirer", gapw: "écart",
    summoning: "Invocation des sons…", search_n: (n) => `Chercher parmi ${n} sons`, search: "Chercher un son", tap_does: "Effet d'un toucher",
    mode_play: "Jouer", mode_preview: "Écouter ici", mode_play_t: "Un toucher le joue sur les enceintes (ou l'ajoute à la file)", mode_preview_t: "Un toucher le joue seulement ici, pour vous",
    all_c: "Tous", favorites: "Favoris", no_match: "Aucun son ne correspond.", queued: "en file",
    fav_add: "Favori", fav_rm: "Retirer des favoris", down_rm: "Démarquer (le garder)", down_add_pub: "Je n'aime pas (le masque aussi)", down_add: "Marquer pour suppression (le masque aussi)",
    hide: "Masquer", unhide: "Afficher", aim: "Jouer maintenant sur des enceintes choisies", aim_title: (t) => `Jouer « ${t} » maintenant sur…`,
    aim_hint: "Hors file : il part tout de suite sur ces enceintes, mélangé à ce qu'elles jouent déjà.", play_now: "Jouer maintenant", cancel: "Annuler",
    preset_name: "Nom du préréglage (ce qui joue où, volumes, pistes d'ambiance) :", preset_del: (n) => `Supprimer le préréglage « ${n} » ?`,
    reset_q: "Oublier tous les favoris, sons masqués, préréglages et réglages enregistrés dans ce navigateur ?", reset_done: "Table de sons remise à neuf",
    imported: "Importé", import_failed: (e) => `Échec de l'import : ${e}`, tick_first: "Cochez d'abord au moins une enceinte pour les effets (onglet Enceintes)",
    haunt: "👻 Mode hanté", haunt_hint: (a, b) => `Une frayeur au hasard toutes les ${a} à ${b} s, toute seule.`, haunt_opts: "Options du mode hanté",
    haunt_every: "Toutes les", haunt_to: "à", haunt_from: "Choisir parmi", favs_only: "♥ Favoris seulement", all_cats: "Toutes les catégories",
    motion: "🏃 Frayeurs au mouvement", motion_hint: "Quand une caméra voit quelqu'un, elle joue une frayeur au hasard (parmi celles du mode hanté) sur son haut-parleur.",
    motion_cool: "Au plus une fois par caméra toutes les", cameras: "Caméras", all_cams: "toutes",
  },
};
const CAT_FR = {
  screams: "Cris", crying: "Pleurs & lamentations", laughs: "Rires maléfiques", "creepy-kids": "Enfants inquiétants",
  ghosts: "Fantômes", voices: "Voix", monsters: "Monstres", zombies: "Zombies", werewolves: "Loups-garous",
  "vampires-bats": "Vampires & chauves-souris", witches: "Sorcières", animals: "Animaux sinistres", house: "Maison hantée",
  stingers: "Coups de théâtre", "weather-bells": "Tonnerre & cloches", gore: "Gore", lab: "Labo du savant fou",
  "heartbeat-breath": "Cœur & souffle", creatures: "Créatures", ambience: "Ambiances", other: "Autres",
};
// config.lang, else the page's choice (public site), else the HA user's language, else the browser's
let LANG = "en";
const setLang = (cfgLang, hass) => {
  const want = cfgLang || LS("lang") || hass?.locale?.language || hass?.language || (navigator.languages || [navigator.language]).join(",");
  LANG = /^fr/i.test(String(want)) ? "fr" : "en";
  return LANG;
};
const T = (k, ...a) => {
  const v = I18N[LANG][k] ?? I18N.en[k];
  return typeof v === "function" ? v(...a) : v ?? k;
};
// a sound's title in the UI language; what a voice SAYS stays verbatim (kept as is in title_fr)
const ttl = (s) => (LANG === "fr" && s?.title_fr) || s?.title || "";
// a bat silhouette: the two wings flap (and glide now and then) around the shoulders, see .bat CSS
const BAT_SVG = `<svg viewBox="0 0 100 44"><path class="wl" d="M47 16C38 8 22 4 4 10c6 3 8 7 7 12 5-3 9-2 11 3 4-4 9-4 12 1 4-4 9-4 13 0z"/>
<path class="wr" d="M53 16c9-8 25-12 43-6-6 3-8 7-7 12-5-3-9-2-11 3-4-4-9-4-12 1-4-4-9-4-13 0z"/>
<path d="M46 9l1.5-6 2 5h1l2-5 1.5 6c1 2 1 4 0 5 2 3 2 9 0 14-1 2-2 3-4 3s-3-1-4-3c-2-5-2-11 0-14-1-1-1-3 0-5z"/></svg>`;
const catName = (cats, c) => (LANG === "fr" && CAT_FR[c]) || cats[c]?.name || c.replace(/-/g, " ");

// ---------------------------------------------------------------------------------------
// Page-level controller: one subscription + one audio engine per browser tab.
// ---------------------------------------------------------------------------------------
class SoundboardController {
  constructor() {
    this.hass = null;
    this.state = null;
    this.lib = null;
    this.libTheme = null;
    this.cards = new Set();
    this.skew = 0;
    this.deviceId = LS("device_id") || (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
    LS("device_id", this.deviceId);
    this.deviceName = LS("device_name") || SoundboardController.guessName();
    this.ctx = null;
    this.buffers = new Map();
    this.signed = new Map();
    this.sfxNodes = new Set(); // the queue's effects
    this.directNodes = new Set(); // "play now" effects, mixed over the queue
    this.layers = new Map(); // background layer id -> { audio, gen }
    this.pool = []; // <audio> elements unlocked by a tap, so layers can start later without one
    this.locked = true;
  }

  static guessName() {
    const ua = navigator.userAgent;
    const dev = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
      : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : "Browser";
    return /Home Assistant/.test(ua) ? `${dev} (HA app)` : `${dev} browser`;
  }

  attach(card, hass) {
    this.cards.add(card);
    if (!this.hass) {
      this.hass = hass;
      this.connect();
    }
    this.hass = hass;
  }

  detach(card) { this.cards.delete(card); }

  async connect() {
    try {
      await this.hass.connection.subscribeMessage((m) => this.onMessage(m), {
        type: "soundboard/subscribe", device_id: this.deviceId, device_name: this.deviceName,
      });
    } catch (e) {
      // e.g. right after an HA restart, before the integration has loaded: retry, don't stay blank
      console.warn("soundboard subscribe", e);
      setTimeout(() => this.connect(), 5000);
    }
  }

  onMessage(m) {
    if (m.type === "state") {
      this.skew = m.state.server_time - Date.now() / 1000;
      this.state = m.state;
      const theme = m.state.settings.theme;
      if (theme !== this.libTheme) this.loadLibrary(theme);
      this.render();
    } else if (m.type === "cmd") {
      this.onCommand(m);
    }
  }

  async loadLibrary(theme) {
    this.libTheme = theme;
    this.lib = await this.hass.callWS({ type: "soundboard/library", theme });
    this.render(true);
  }

  render(full = false) { for (const c of this.cards) c.update(full); }

  now() { return Date.now() / 1000 + this.skew; }

  ws(msg) {
    return this.hass.callWS(msg).catch((e) => console.warn("soundboard", msg.type, e));
  }

  patch(p) {
    // optimistic: keep the UI snappy, the server echo confirms
    const deep = (d, s) => {
      for (const k in s) {
        if (s[k] && typeof s[k] === "object" && !Array.isArray(s[k])) deep(d[k] && typeof d[k] === "object" ? d[k] : (d[k] = {}), s[k]);
        else d[k] = s[k];
      }
    };
    if (this.state) { deep(this.state.settings, p); this.render(); }
    return this.ws({ type: "soundboard/settings", patch: p });
  }

  isHidden(id) {
    const h = (this.state?.hidden || {})[this.libTheme] || {};
    if (id in h) return h[id];
    const it = this.lib?.sfx.find((s) => s.id === id) || this.lib?.music.find((s) => s.id === id);
    return !!it?.default_hidden;
  }

  marks(id) { return ((this.state?.marks || {})[this.libTheme] || {})[id] || {}; }

  // optimistic local update so the icon flips instantly; the server echo confirms
  toggleMark(id, key) {
    const on = !this.marks(id)[key];
    const t = ((this.state.marks ||= {})[this.libTheme] ||= {});
    const m = (t[id] ||= {});
    if (on) m[key] = true; else delete m[key];
    if (key === "down") {
      const h = ((this.state.hidden ||= {})[this.libTheme] ||= {});
      if (on) h[id] = true; else delete h[id];
    }
    this.render();
    return this.ws({ type: "soundboard/mark", theme: this.libTheme, ids: [id], [key]: on });
  }

  toggleHidden(id) {
    const hide = !this.isHidden(id);
    ((this.state.hidden ||= {})[this.libTheme] ||= {})[id] = hide;
    this.render();
    return this.ws({ type: "soundboard/hide", theme: this.libTheme, ids: [id], hidden: hide });
  }

  // favourites first, otherwise library order
  favFirst(list) {
    return list.map((s, i) => [s, i]).sort((a, b) => (!!this.marks(b[0].id).fav - !!this.marks(a[0].id).fav) || a[1] - b[1]).map((x) => x[0]);
  }

  // ----- local audio ("This device" + previews) -----
  unlock() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
    if (!this.pool.length) {
      // mobile browsers only let an <audio> play from a tap: bless a few now, one per mixed layer
      for (let i = 0; i < 6; i++) {
        const a = new Audio();
        a.preload = "auto";
        a.src = SILENT_WAV;
        a.play().then(() => { if (a.src === SILENT_WAV) a.pause(); }).catch(() => {});
        // a refused link must not be retried: stop here, the next track/command re-signs
        a.addEventListener("error", () => { if (a.src !== SILENT_WAV) { a.removeAttribute("src"); a.load(); } });
        this.pool.push(a);
      }
    }
    if (this.locked) {
      this.locked = false;
      this.render();
    }
  }

  // HA counts every refused signed link as a failed login and bans the IP after 60, so a
  // link is never replayed once refused (re-signed instead) and a failing URL is not
  // re-fetched for a minute.
  async sign(url, fresh = false) {
    if (/^https?:/.test(url)) return url; // a sound streamed from its origin (public build), nothing to sign
    const hit = this.signed.get(url);
    if (!fresh && hit && hit.exp > Date.now()) return hit.url;
    const r = await this.hass.callWS({ type: "auth/sign_path", path: url, expires: 86400 });
    this.signed.set(url, { url: r.path, exp: Date.now() + 82800e3 });
    return r.path;
  }

  async buffer(url) {
    if (this.buffers.has(url)) return this.buffers.get(url);
    if ((this.failed?.get(url) || 0) > Date.now()) return Promise.reject(new Error("recently refused"));
    const p = (async () => {
      const res = await fetch(await this.sign(url));
      if (!res.ok) {
        this.signed.delete(url);
        (this.failed ||= new Map()).set(url, Date.now() + 60e3);
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.arrayBuffer();
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      return await this.ctx.decodeAudioData(data);
    })();
    this.buffers.set(url, p);
    p.catch(() => this.buffers.delete(url));
    return p;
  }

  async playLocal(url, volume = 1, direct = false) {
    if (!this.ctx) this.unlock();
    const buf = await this.buffer(url);
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.buffer = buf;
    src.connect(gain).connect(this.ctx.destination);
    src.gainNode = gain;
    const set = direct ? this.directNodes : this.sfxNodes;
    src.onended = () => set.delete(src);
    set.add(src);
    src.start();
  }

  stopLocalSfx(which = "all") {
    for (const set of which === "all" ? [this.sfxNodes, this.directNodes] : [which === "direct" ? this.directNodes : this.sfxNodes]) {
      for (const n of set) { try { n.stop(); } catch (e) { /* already ended */ } }
      set.clear();
    }
  }

  async onCommand(m) {
    if (m.cmd === "sfx") {
      this.playLocal(m.url, m.volume, !!m.direct).catch((e) => console.warn("soundboard sfx", e));
    } else if (m.cmd === "sfx_volume") {
      for (const n of this.sfxNodes) n.gainNode.gain.value = m.volume;
    } else if (m.cmd === "sfx_stop") {
      this.stopLocalSfx("queue");
    } else if (m.cmd === "direct_stop") {
      this.stopLocalSfx("direct");
    } else if (m.cmd === "music") {
      const id = m.layer || "main";
      const l = this.layer(id);
      // signing is a round trip: a stop arriving meanwhile must win over this play
      const gen = ++l.gen;
      const a = l.audio;
      // a looping layer loops by itself here: a repeat of the same track must not restart it
      if (m.loop && l.url === m.url && !a.paused) { a.volume = clamp01(m.volume); return; }
      const src = await this.sign(m.url, true);
      if (gen !== l.gen || this.layers.get(id) !== l) return;
      l.url = m.url;
      a.loop = !!m.loop;
      // fresh link per track: a 7 h track streams with range requests for hours, so a
      // cached link close to its 24 h expiry would start being refused mid-track
      a.src = src;
      a.volume = clamp01(m.volume);
      const start = () => { try { a.currentTime = m.offset; } catch (e) { /* not seekable yet */ } a.play().catch(() => { this.locked = true; this.render(); }); };
      if (a.readyState >= 1) start(); else a.addEventListener("loadedmetadata", start, { once: true });
    } else if (m.cmd === "music_stop") {
      for (const id of m.layer ? [m.layer] : [...this.layers.keys()]) this.dropLayer(id);
    } else if (m.cmd === "music_volume") {
      for (const [id, v] of Object.entries(m.layers || {})) { const l = this.layers.get(id); if (l) l.audio.volume = clamp01(v); }
    }
  }

  layer(id) {
    let l = this.layers.get(id);
    if (!l) {
      const audio = this.pool.find((a) => ![...this.layers.values()].some((x) => x.audio === a)) || new Audio();
      l = { audio, gen: 0 };
      this.layers.set(id, l);
    }
    return l;
  }

  dropLayer(id) {
    const l = this.layers.get(id);
    if (!l) return;
    l.gen++;
    l.audio.pause();
    this.layers.delete(id);
  }

  prefetch(ids) {
    // decode effects ahead of time when this device is a selected speaker
    const todo = ids.filter((u) => !this.buffers.has(u));
    let i = 0;
    const next = () => { if (i < todo.length) this.buffer(todo[i++]).catch(() => {}).finally(next); };
    for (let k = 0; k < 3; k++) next();
  }
}

const SB = (window.__soundboard = window.__soundboard || new SoundboardController());

// ---------------------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------------------
class SoundboardCard extends HTMLElement {
  // guest: true (a guest-only page outside the HA frontend) = no favourite/delete/hide buttons, no
  //   "Show hidden", no preset saving, no motion scares, no per-sound speaker picking.
  // standalone: true (the public GitHub Pages build) = no house speakers: the page itself is the
  //   only speaker, the backend is soundboard-local.js in the browser; language switch, data tools.
  // lang: "en" | "fr" to force the language.
  setConfig(config) {
    this.config = config || {};
    this.ui.tab ||= this.config.standalone ? "snd" : "spk";
  }
  getCardSize() { return 12; }

  set hass(hass) {
    this._hass = hass;
    setLang(this.config.lang, hass);
    if (!this.shadowRoot) this.build();
    SB.attach(this, hass);
    if (SB.state) this.update(!this._rendered);
  }

  connectedCallback() { if (this._hass) SB.attach(this, this._hass); }
  disconnectedCallback() { SB.detach(this); }

  constructor() {
    super();
    this.config = {};
    this.ui = {
      tapMode: "queue",
      showHidden: LS("show_hidden") || false,
      showHiddenMusic: LS("show_hidden_music") || false,
      filter: "",
      category: LS("category") || "all",
      collapsed: { hist: true, ...(LS("collapsed") || {}) },
      tab: LS("tab"), // spk: speakers + volumes, snd: background + effects
      aim: null, // sound id whose "play now" speaker picker is open
      aimSpk: LS("aim_speakers"),
    };
  }

  build() {
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${STYLE}</style>
      <div class="wrap ${this.config.standalone ? "standalone" : ""}">
        <div class="fog" aria-hidden="true"></div>
        <div class="flash-sky" aria-hidden="true"></div>
        <div class="bats" aria-hidden="true"><i class="moon"></i>${[1, 2, 3, 4].map((n) => `<span class="bat b${n}"><span class="bob">${BAT_SVG}</span></span>`).join("")}</div>
        <header class="top"></header>
        <nav class="bar"></nav>
        <div class="lock" hidden></div>
        <section class="sec dev" data-tab="spk"><div class="sec-b dev-b"></div></section>
        <section class="sec fx" data-sec="fx" data-tab="snd">
          <h2 class="sec-h"><span class="fx-h"></span><span class="sec-sub fx-sub"></span><ha-icon class="chev" icon="mdi:chevron-down"></ha-icon></h2>
          <div class="sec-b">
            <div class="via" data-panel="sfx"></div>
            <div class="row ctl fx-ctl"></div>
            <div class="haunt"></div>
            <div class="queue"></div>
            <div class="bank-tools"></div>
            <div class="cats"></div>
            <div class="bank"></div>
          </div>
        </section>
        <section class="sec music" data-sec="music" data-tab="snd">
          <h2 class="sec-h"><span class="music-h"></span><span class="sec-sub music-sub"></span><ha-icon class="chev" icon="mdi:chevron-down"></ha-icon></h2>
          <div class="sec-b">
            <div class="via" data-panel="music"></div>
            <div class="row ctl music-ctl"></div>
            <div class="np"></div>
            <div class="music-tools"></div>
            <div class="tracks"></div>
          </div>
        </section>
        <section class="sec hist" data-sec="hist" data-tab="snd">
          <h2 class="sec-h"><span class="hist-h"></span><span class="sec-sub hist-sub"></span><ha-icon class="chev" icon="mdi:chevron-down"></ha-icon></h2>
          <div class="sec-b"><div class="hist-list"></div></div>
        </section>
        <div class="aim" hidden></div>
      </div>`;
    root.addEventListener("pointerdown", () => SB.unlock(), { passive: true });
    root.addEventListener("click", (e) => this.onClick(e));
    root.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("tile")) { e.preventDefault(); e.target.click(); }
      if (e.key === "Escape" && this.ui.aim) { this.ui.aim = null; this.update(); }
    });
    root.addEventListener("input", (e) => this.onInput(e));
    root.addEventListener("change", (e) => this.onChange(e));
    root.addEventListener("toggle", (e) => {
      if (e.target.classList?.contains("opts")) this.ui.opts = e.target.open;
      if (e.target.classList?.contains("h-opts")) this.ui.hopts = e.target.open;
    }, true);
    this.$ = (s) => root.querySelector(s);
  }

  // ----- rendering -----
  update(full = false) {
    if (!this.shadowRoot || !SB.state) return;
    this._rendered = true;
    const st = SB.state;
    const theme = (st.themes || []).find((t) => t.id === st.settings.theme) || {};
    if (this._lang !== LANG) { this._lang = LANG; full = true; }
    this.style.setProperty("--sb-accent", theme.accent || "#ff7518");
    this.style.setProperty("--sb-accent2", theme.accent2 || "#9b59ff");
    const lock = this.$(".lock");
    lock.hidden = !(SB.locked && this.thisDeviceSelected());
    this.setHTML(".lock", this.config.standalone ? T("lock_public") : T("lock_house"));
    this.setHTML(".fx-h", T("sfx"));
    this.setHTML(".music-h", T("bg"));
    this.setHTML(".hist-h", T("hist"));
    for (const s of ["music", "fx", "hist"]) this.$(`.sec.${s}`).classList.toggle("collapsed", !!this.ui.collapsed[s]);
    for (const sec of this.shadowRoot.querySelectorAll(".sec[data-tab]")) sec.classList.toggle("off-tab", sec.dataset.tab !== this.ui.tab);
    this.renderTop(theme);
    this.renderBar(theme);
    this.renderMusic();
    this.renderDevices();
    this.renderVia("music");
    this.renderVia("sfx");
    this.renderFxControls();
    this.renderHaunt();
    this.renderQueue();
    this.renderHistory();
    this.renderAim();
    const q = st.queue;
    const cur = q.items.find((i) => i.uid === q.current && !i.waiting);
    const queued = q.items.filter((i) => i.status === "pending" && i.type === "sound").map((i) => i.id);
    const bankKey = JSON.stringify([LANG, SB.libTheme, SB.lib?.sfx?.length, this.ui, st.hidden?.[SB.libTheme], st.marks?.[SB.libTheme], cur?.id, queued]);
    if (full || bankKey !== this._bankKey) {
      this._bankKey = bankKey;
      this.renderBank(cur, queued);
    }
    if (this.thisDeviceSelected("sfx") && SB.lib) {
      // standalone: every effect would be decoded into memory on a phone; only favourites go ahead
      SB.prefetch(SB.lib.sfx.filter((s) => !SB.isHidden(s.id) && s.duration < 60 && (!this.config.standalone || SB.marks(s.id).fav)).map((s) => s.url));
    }
  }

  setHTML(sel, html) {
    const el = this.$(sel);
    if (el && el._html !== html) { el.innerHTML = html; el._html = html; }
  }

  thisDeviceSelected(panel) {
    const id = "browser:" + SB.deviceId;
    const s = SB.state?.settings;
    if (!s) return false;
    if (panel) return s[panel].speakers.includes(id);
    return s.music.speakers.includes(id) || s.sfx.speakers.includes(id);
  }

  renderTop(theme) {
    const st = SB.state;
    const themes = [...(st.themes || [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    const n = SB.lib ? SB.lib.sfx.filter((s) => !SB.isHidden(s.id)).length : 0;
    const name = LANG === "fr" && theme.id === "halloween" ? "Halloween" : theme.name;
    this.setHTML(".top", `
      <div class="brand"><span class="emoji">${esc(theme.emoji || "🎃")}</span>
        <div><div class="title">${esc(name || T("soundboard"))}</div>
        <div class="subtitle">${T("soundboard")}${n ? ` · ${T("sounds_n", n)}` : ""}</div></div></div>
      ${themes.length > 1 ? `<div class="themes">${themes.map((t) => `<button class="chip theme ${t.id === st.settings.theme ? "on" : ""}" data-act="theme" data-id="${esc(t.id)}">${esc(t.emoji || "")} ${esc(t.name)}</button>`).join("")}</div>` : ""}
      ${this.config.standalone ? `<div class="langs" role="group" aria-label="Language">${["en", "fr"].map((l) =>
        `<button class="chip lang ${LANG === l ? "on" : ""}" data-act="lang" data-id="${l}" aria-pressed="${LANG === l}">${l.toUpperCase()}</button>`).join("")}</div>` : ""}`);
  }

  // sticky: the two tabs and STOP ALL stay at hand while scrolling the sound bank
  renderBar(theme) {
    const s = SB.state.settings, m = SB.state.music, q = SB.state.queue;
    const tab = (id, label, sub) => `<button class="tab ${this.ui.tab === id ? "on" : ""}" data-act="tab" data-tab="${id}" aria-pressed="${this.ui.tab === id}">
      <span class="tab-l">${label}</span><small class="tab-sub">${sub}</small></button>`;
    const pct = (v) => `${Math.round(v * 100)}%`;
    const spk = this.config.standalone
      ? tab("spk", T("tab_volume"), `🎼 ${pct(s.music.volume)} · 💀 ${pct(s.sfx.volume)}`)
      : tab("spk", T("tab_speakers"), `🎼 ${s.music.speakers.length} · 💀 ${s.sfx.speakers.length}`);
    const haunt = s.haunt?.on;
    const live = [m.playing ? `🎼 ${T("on")}` : "", q.running ? `💀 ${T("on")}` : "", haunt ? "👻" : "", s.motion?.on && !this.config.guest ? "🏃" : ""].filter(Boolean).join(" · ");
    this.setHTML(".bar", spk + tab("snd", `${esc(theme.emoji || "🎃")} ${T("tab_sounds")}`, live || T("pick_play"))
      + `<button class="stopall ${m.playing || q.running || haunt ? "live" : ""}" data-act="stopall" title="${T("stop_all_t")}"><ha-icon icon="mdi:stop-circle"></ha-icon><span>${T("stop_all")}</span></button>`);
  }

  renderMusic() {
    const st = SB.state, lib = SB.lib, ms = st.settings.music, m = st.music;
    if (!lib) return;
    const sel = new Set(ms.tracks);
    const hiddenM = lib.music.filter((t) => SB.isHidden(t.id));
    const downM = hiddenM.filter((t) => SB.marks(t.id).down).length;
    this.setHTML(".music-tools", this.config.guest || !hiddenM.length ? "" : `<label class="tog sm" title="${T("show_hidden_t")}">
        <input type="checkbox" data-act="showhiddenmusic" ${this.ui.showHiddenMusic ? "checked" : ""}> ${T("show_hidden")} <small class="muted">${hiddenM.length}${downM ? ` · ${downM} 👎` : ""}</small></label>`);
    // a selected track stays listed even when hidden, so it can be unticked
    const tracks = SB.favFirst(lib.music.filter((t) => this.ui.showHiddenMusic || !SB.isHidden(t.id) || sel.has(t.id)));
    const layers = m.playing ? m.layers : [];
    const levels = ms.levels || {};
    this.setHTML(".tracks", tracks.length ? tracks.map((t) => {
      const lvl = Math.round((levels[t.id] ?? 1) * 100);
      // the slider sits outside the <label> so dragging it doesn't tick the box
      return `<div class="track-w ${sel.has(t.id) ? "sel" : ""}"><label class="track ${layers.some((l) => l.track === t.id) ? "playing" : ""} ${this.markClass(t.id)}">
        <input type="checkbox" data-act="track" data-id="${esc(t.id)}" ${sel.has(t.id) ? "checked" : ""}>
        <span class="t-title">${esc(ttl(t))}</span>${this.icons(t.id, fmtDur(t.duration), false)}
      </label>${ms.mix && sel.has(t.id) ? `<div class="lvl"><ha-icon icon="mdi:volume-high"></ha-icon>
        <input type="range" min="0" max="150" step="5" value="${lvl}" data-act="level" data-id="${esc(t.id)}" list="lvl-100"
          title="${T("level_t")}"><span class="lvl-v">${lvl}%</span></div>` : ""}</div>`;
    }).join("") + `<datalist id="lvl-100"><option value="100"></option></datalist>`
      : `<div class="empty">${T("no_tracks")}</div>`);
    const np = layers.map((l) => {
      const el = Math.max(0, SB.now() - l.started);
      return `<div class="np-row"><span class="eq"><i></i><i></i><i></i></span><span class="np-t">${esc(ttl(SB.lib.music.find((t) => t.id === l.track)) || l.title)}</span>
        <span class="dur">${l.count > 1 ? `${l.index + 1}/${l.count} · ` : ""}${fmtDur(l.duration)}</span></div>
        <div class="bar-p"><div class="fill" style="animation-duration:${l.duration}s;animation-delay:-${el}s"></div></div>`;
    }).join("");
    this.setHTML(".np", np);
    this.setHTML(".music-sub", layers.length ? `▶ ${layers.length > 1 ? T("mixed_n", layers.length) : esc(ttl(lib.music.find((t) => t.id === layers[0].track)) || layers[0].title)}` : "");
    const nSel = ms.tracks.length;
    this.setHTML(".music-ctl", `
      <button class="btn primary" data-act="mplay" ${nSel ? "" : "disabled"}><ha-icon icon="mdi:play"></ha-icon> ${m.playing ? T("restart") : T("play")}${nSel > 1 ? ` ${ms.mix ? T("n_mixed", nSel) : T("n_tracks", nSel)}` : ""}</button>
      <button class="btn" data-act="mnext" ${m.playing && !m.mix && layers[0]?.count > 1 ? "" : "disabled"} aria-label="${T("next_track")}"><ha-icon icon="mdi:skip-next"></ha-icon></button>
      <button class="btn" data-act="mstop" ${m.playing ? "" : "disabled"}><ha-icon icon="mdi:stop"></ha-icon> ${T("stop")}</button>
      <label class="tog"><input type="checkbox" data-act="mloop" ${ms.loop ? "checked" : ""}> ${T("loop")}</label>
      <label class="tog" title="${T("mix_t")}"><input type="checkbox" data-act="mmix" ${ms.mix ? "checked" : ""}> ${T("mix")}</label>
      ${!nSel ? `<span class="hint">${T("tick_tracks")}</span>` : ""}`);
  }

  renderHistory() {
    const h = SB.state.history;
    const sec = this.$(".sec.hist");
    sec.hidden = !!this.config.guest || !h;
    if (sec.hidden) return;
    const loc = LANG === "fr" ? "fr-FR" : [];
    const today = new Date().toDateString();
    const when = (t) => {
      const d = new Date(t * 1000);
      const hm = d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
      return d.toDateString() === today ? hm : `${d.toLocaleDateString(loc, { day: "numeric", month: "short" })} ${hm}`;
    };
    this.setHTML(".hist-sub", h.length ? esc(h[h.length - 1].text) : "");
    this.setHTML(".hist-list", h.length ? [...h].reverse().map((e) => `
      <div class="h-row ${e.undone ? "undone" : ""}"><span class="h-t">${when(e.t)}</span>${this.config.standalone ? "" : `<span class="h-who">${esc(e.who)}</span>`}
        <span class="h-x">${esc(e.text)}</span>
        ${e.undo ? (e.undone ? `<span class="h-tag">${T("undone")}</span>` : `<button class="btn sm" data-act="undo" data-id="${esc(e.id)}">${T("undo")}</button>`) : ""}</div>`).join("")
      : `<div class="empty">${T("hist_empty")}</div>`);
  }

  // Speakers tab: presets, the two masters, motion scares, one row per speaker (🎼 / 💀 + its level)
  renderDevices() {
    const st = SB.state, s = st.settings, cfg = this.config;
    const P = [["music", "🎼", T("background")], ["sfx", "💀", T("effects")]];
    const master = ([p, emoji, label]) => {
      const v = Math.round(s[p].volume * 100);
      return `<div class="mvol"><span class="mvol-l">${emoji} ${label}</span>
        <input type="range" min="0" max="100" step="1" value="${v}" data-act="vol" data-panel="${p}" aria-label="${T("volume_of", label)}"><span class="vol-v">${v}%</span></div>`;
    };
    const presets = st.presets || [];
    const canEdit = !cfg.guest;
    const presetsHtml = (presets.length || canEdit) ? `<div class="presets"><span class="lbl">${T("presets")}</span>
      ${presets.map((p) => `<span class="preset"><button class="chip" data-act="papply" data-id="${esc(p.id)}" title="${T("apply")}: ${esc(this.presetSummary(p))}">✨ ${esc(p.name)}</button>${canEdit
        ? `<button class="px" data-act="pdel" data-id="${esc(p.id)}" aria-label="${esc(T("delete_preset", p.name))}">×</button>` : ""}</span>`).join("")}
      ${canEdit ? `<button class="chip ghost" data-act="psave" title="${T("save_current_t")}">${T("save_current")}</button>` : ""}
      ${!presets.length && canEdit ? `<span class="hint">${T("preset_eg")}</span>` : ""}</div>` : "";
    const masters = `<div class="masters">${P.map(master).join("")}
      <div class="hint">${cfg.standalone ? T("hint_public") : T("hint_house")}</div></div>`;
    if (cfg.standalone) {
      const offlineDone = LS("offline_done");
      this.setHTML(".dev-b", presetsHtml + masters + `
        <div class="data"><span class="lbl">${T("your_data")}</span>
          <span class="hint">${T("data_hint")}</span>
          <div class="ctl-line"><button class="btn sm" data-act="dexport"><ha-icon icon="mdi:download"></ha-icon> ${T("export")}</button>
          <button class="btn sm" data-act="dimport"><ha-icon icon="mdi:upload"></ha-icon> ${T("import")}</button>
          <button class="btn sm danger" data-act="dreset"><ha-icon icon="mdi:delete-sweep"></ha-icon> ${T("reset")}</button></div>
          <button class="btn sm offline ${offlineDone ? "done" : ""}" data-act="offline" title="${T("offline_t")}"><ha-icon icon="mdi:cloud-download"></ha-icon> ${T("offline")}${offlineDone ? " ✓" : ""}</button>
          <span class="hint">${T("offline_t")}</span></div>`);
      return;
    }
    const sel = { music: new Set(s.music.speakers), sfx: new Set(s.sfx.speakers) };
    const trim = s.trim || {};
    const me = "browser:" + SB.deviceId;
    const outs = [...st.outputs];
    // "This device" always offered, even before the server lists it
    if (!outs.some((o) => o.id === me)) outs.push({ id: me, name: SB.deviceName, group: "outdoor", kind: "browser", available: true, ready: "ok" });
    const row = (o) => {
      const name = o.id === me ? T("this_device") : o.name;
      const dot = o.kind === "camera" && o.ready !== "cold" ? `<i class="dot ${o.ready}"></i>` : "";
      const t = Math.round((trim[o.id] ?? 1) * 100);
      return `<div class="dev-row ${o.available ? "" : "na"}" title="${esc(o.id === me ? T("this_device_t", o.name) : o.id)}">
        <span class="dev-n"><ha-icon icon="${KIND_ICON[o.kind] || "mdi:speaker"}"></ha-icon><span>${esc(name)}</span>${dot}</span>
        ${P.map(([p, emoji, label]) => `<button class="chip tg ${sel[p].has(o.id) ? "on" : ""}" data-act="spk" data-panel="${p}" data-id="${esc(o.id)}"
          aria-pressed="${sel[p].has(o.id)}" aria-label="${esc(T("on_x", label, name))}">${emoji}</button>`).join("")}
        <span class="trim ${t < 100 ? "cut" : ""}"><input type="range" min="0" max="100" step="5" value="${t}" data-act="trim" data-id="${esc(o.id)}"
          aria-label="${esc(T("level_of", name))}" title="${T("level_t2")}"><b class="trim-v">${t}%</b></span></div>`;
    };
    const groups = [["devices", T("devices")], ["outdoor", T("outdoor")], ["indoor", T("indoor")]].map(([g, label]) => {
      const list = this.groupOuts(outs, g);
      if (g === "devices") return list.map(row).join("");
      return `<div class="dev-row dev-h"><span class="dev-n">${label}</span>
        ${P.map(([p]) => {
          const full = list.length && list.every((o) => sel[p].has(o.id));
          return `<span class="tg-h"><button class="link" data-act="${full ? "grpnone" : "grpall"}" data-panel="${p}" data-group="${g}">${full ? T("none") : T("all")}</button></span>`;
        }).join("")}<span></span></div>
        ${list.map(row).join("")}`;
    }).join("");
    const cams = st.outputs.filter((o) => o.kind === "camera");
    const warmN = cams.filter((o) => o.ready === "warm").length;
    const conN = cams.filter((o) => o.ready === "connecting").length;
    const warmTxt = st.warm ? (conN ? T("connecting_n", conN) : T("ready_n", warmN)) : T("off");
    this.setHTML(".dev-b", presetsHtml + masters + (cfg.guest ? "" : this.motionHtml(cams)) + `
      <div class="dev-t"><div class="dev-row dev-cols"><span class="dev-n">${T("speakers")}</span>${P.map(([, emoji, label]) => `<span class="tg-h" title="${label}"><span>${emoji}</span><small>${label}</small></span>`).join("")}<span class="tg-h" title="${T("level_t2")}"><span>🎚️</span><small>${T("level")}</small></span></div>
        <div class="warm-row"><button class="chip warm ${st.warm ? "on" : ""}" data-act="warm" title="${T("instant_t")}">
          <ha-icon icon="mdi:flash"></ha-icon> ${T("instant")}: ${warmTxt}</button></div>
        ${groups}</div>`);
  }

  // HA only, admins only (the server refuses it from guests too)
  motionHtml(cams) {
    const m = SB.state.settings.motion;
    if (!m || !cams.length) return "";
    const picked = new Set(m.cams || []);
    return `<div class="motion ${m.on ? "on" : ""}">
      <label class="tog big"><input type="checkbox" data-act="motion" ${m.on ? "checked" : ""}> ${T("motion")}</label>
      <span class="hint">${T("motion_hint")}</span>
      <div class="chips"><span class="lbl">${T("cameras")}</span>
        <button class="chip ${!picked.size ? "on" : ""}" data-act="mcam" data-id="">${T("all_cams")}</button>
        ${cams.map((c) => `<button class="chip ${picked.has(c.id) ? "on" : ""}" data-act="mcam" data-id="${esc(c.id)}">${esc(c.name)}</button>`).join("")}</div>
      <div class="ctl-line gap"><span>${T("motion_cool")}</span>
        <input type="range" min="10" max="600" step="10" value="${m.cooldown_s}" data-act="mcool" aria-label="${T("motion_cool")}"><b class="gap-v">${m.cooldown_s}s</b></div>
    </div>`;
  }

  // Effects section: haunt mode (a random scare every few seconds, by itself)
  renderHaunt() {
    const h = SB.state.settings.haunt;
    if (!h || !SB.lib) { this.setHTML(".haunt", ""); return; }
    const cats = SB.lib.categories || {};
    const catIds = [...new Set(SB.lib.sfx.map((s) => s.category))].sort((a, b) => (cats[a]?.order ?? 99) - (cats[b]?.order ?? 99) || a.localeCompare(b));
    const picked = new Set(h.cats || []);
    this.setHTML(".haunt", `<div class="haunt-in ${h.on ? "on" : ""}">
      <label class="tog big"><input type="checkbox" data-act="haunt" ${h.on ? "checked" : ""}> ${T("haunt")}</label>
      <span class="hint">${T("haunt_hint", h.min_s, h.max_s)}</span>
      <details class="h-opts" ${this.ui.hopts ? "open" : ""}><summary>${T("haunt_opts")}</summary>
        <div class="ctl-line gap"><span>${T("haunt_every")}</span>
          <input type="range" min="5" max="300" step="5" value="${h.min_s}" data-act="hmin" aria-label="min"><b class="gap-v">${h.min_s}s</b>
          <span>${T("haunt_to")}</span>
          <input type="range" min="10" max="600" step="5" value="${h.max_s}" data-act="hmax" aria-label="max"><b class="gap-v">${h.max_s}s</b></div>
        <div class="chips"><span class="lbl">${T("haunt_from")}</span>
          <button class="chip ${h.favs ? "on" : ""}" data-act="hfavs">${T("favs_only")}</button>
          <button class="chip ${!picked.size ? "on" : ""}" data-act="hcat" data-id="">${T("all_cats")}</button>
          ${catIds.map((c) => `<button class="chip ${picked.has(c) ? "on" : ""}" data-act="hcat" data-id="${esc(c)}">${cats[c]?.emoji || CAT_EMOJI[c] || "🎵"} ${esc(catName(cats, c))}</button>`).join("")}</div>
      </details></div>`);
  }

  // "devices": this device first, then other phones / tablets with the page open (they can be
  // indoors or out); outdoor / indoor: the house speakers
  groupOuts(outs, g) {
    const me = "browser:" + SB.deviceId;
    if (g === "devices") {
      return outs.filter((o) => o.kind === "browser" && (o.id === me || o.available)).sort((a, b) => (b.id === me) - (a.id === me));
    }
    return outs.filter((o) => o.group === g && o.kind !== "browser");
  }

  presetSummary(p) {
    return T("p_summary", (p.music?.speakers || []).length, Math.round((p.music?.volume ?? 0) * 100),
      (p.sfx?.speakers || []).length, Math.round((p.sfx?.volume ?? 0) * 100), (p.music?.tracks || []).length, p.music?.mix);
  }

  applyPreset(id) {
    const p = (SB.state.presets || []).find((x) => x.id === id);
    if (!p) return;
    const known = new Set((SB.lib?.music || []).map((t) => t.id));
    const music = { ...p.music, tracks: (p.music.tracks || []).filter((t) => known.has(t)),
      levels: Object.fromEntries(Object.entries(p.music.levels || {}).filter(([t]) => known.has(t))) };
    const patch = { music, sfx: { ...p.sfx }, trim: { ...(p.trim || {}) } };
    if (this.config.standalone) { delete music.speakers; delete patch.sfx.speakers; delete patch.trim; }
    SB.patch(patch);
    this.toast(T("preset_applied", p.name));
  }

  // Sounds tab: where each section plays, with a shortcut to the first tab
  renderVia(panel) {
    const s = SB.state.settings[panel];
    const n = s.speakers.length;
    const what = this.config.standalone ? T("volume") : T("n_speakers", n);
    this.setHTML(`.via[data-panel="${panel}"]`, `<button class="via-b ${n ? "" : "warn"}" data-act="tab" data-tab="spk">
      <ha-icon icon="mdi:volume-high"></ha-icon><span>${n ? `${what} · ${Math.round(s.volume * 100)}%` : T("no_speaker")}</span>
      <span class="link">${T("change")}</span></button>`);
  }

  renderFxControls() {
    const s = SB.state.settings.sfx, q = SB.state.queue;
    const pending = q.items.filter((i) => i.status === "pending").length;
    this.setHTML(".fx-ctl", `
      <div class="ctl-line">
        <button class="btn primary" data-act="qplay" ${q.items.length && !q.running ? "" : "disabled"}><ha-icon icon="mdi:play"></ha-icon> ${pending ? T("play_n", pending) : T("replay_all")}</button>
        <button class="btn" data-act="qskip" ${q.running ? "" : "disabled"} aria-label="${T("skip")}"><ha-icon icon="mdi:skip-next"></ha-icon><span class="bt"> ${T("skip")}</span></button>
        <button class="btn" data-act="qstop" ${q.running ? "" : "disabled"} aria-label="${T("stop")}"><ha-icon icon="mdi:stop"></ha-icon><span class="bt"> ${T("stop")}</span></button>
        <button class="btn" data-act="qclear" ${q.items.length ? "" : "disabled"} aria-label="${T("clear_t")}"><ha-icon icon="mdi:delete-sweep"></ha-icon><span class="bt"> ${T("clear")}</span></button>
      </div>
      <details class="opts" ${this.ui.opts ? "open" : ""}><summary>${T("q_options")} <small>${[s.autoplay ? T("plays_on_tap") : T("build_then_play"), s.loop ? T("loop") : "", s.gap ? T("gap_s", s.gap) : ""].filter(Boolean).join(" · ")}</small></summary>
        <div class="ctl-line">
          <label class="tog"><input type="checkbox" data-act="autoplay" ${s.autoplay ? "checked" : ""}> ${T("play_on_tap")}</label>
          <label class="tog"><input type="checkbox" data-act="qloop" ${s.loop ? "checked" : ""}> ${T("loop")}</label>
          <button class="btn sm pause-add" data-act="addpause"><ha-icon icon="mdi:timer-sand"></ha-icon> ${T("add_pause")}</button>
          <span class="stepper"><button class="btn sm" data-act="pstep" data-d="-1" aria-label="${T("shorter")}">−</button><b>${s.pause_s}s</b><button class="btn sm" data-act="pstep" data-d="1" aria-label="${T("longer")}">+</button></span>
        </div>
        <div class="ctl-line gap"><span>${T("gap")}</span>
          <input type="range" min="0" max="120" step="1" value="${s.gap}" data-act="gap" aria-label="${T("gap")}"><b class="gap-v">${s.gap}s</b></div>
      </details>`);
    this.setHTML(".fx-sub", q.running ? T("playing") : pending ? T("queued_n", pending) : SB.state.settings.haunt?.on ? "👻" : "");
  }

  renderQueue() {
    const q = SB.state.queue;
    const cats = SB.lib?.categories || {};
    if (!q.items.length) {
      this.setHTML(".queue", `<div class="empty">${SB.state.settings.sfx.autoplay ? T("q_empty_tap") : T("q_empty_build")}</div>`);
      return;
    }
    const el = q.current_started ? Math.max(0, SB.now() - q.current_started) : 0;
    const gapLeft = q.gap_until ? Math.max(0, q.gap_until - SB.now()) : 0;
    this.setHTML(".queue", `<div class="q-items">${q.items.map((i) => {
      const cur = i.uid === q.current;
      const title = i.type === "sound" ? (ttl(SB.lib?.sfx.find((x) => x.id === i.id)) || i.title) : i.title;
      const emoji = i.type === "pause" ? "⏸" : (cats[i.category]?.emoji || CAT_EMOJI[i.category] || "🎵");
      return `<span class="q ${i.status} ${cur ? "cur" : ""} ${i.waiting ? "waiting" : ""}" title="${i.waiting ? T("waiting") : ""}${esc(title)}${i.speakers ? T("pinned", i.speakers.length) : ""}${i.volume != null ? `, ${Math.round(i.volume * 100)}%` : ""}">
        ${i.waiting ? `<span class="q-spin" aria-label="…"></span>` : `<span class="q-e">${emoji}</span>`}<span class="q-t">${i.type === "pause" ? `${fmtDur(i.duration)}` : esc(title)}</span>
        ${i.speakers ? `<span class="q-n">${i.speakers.length}🔊</span>` : ""}
        <button class="q-x" data-act="qrm" data-uid="${i.uid}" aria-label="${T("remove")}">×</button>
        ${cur && !i.waiting ? `<span class="q-bar" style="animation-duration:${i.duration}s;animation-delay:-${el}s"></span>` : ""}
      </span>`;
    }).join("")}${gapLeft > 0 ? `<span class="q gapchip"><span class="q-e">⏳</span><span class="q-t">${T("gapw")}</span><span class="q-bar" style="animation-duration:${SB.state.settings.sfx.gap}s;animation-delay:-${SB.state.settings.sfx.gap - gapLeft}s"></span></span>` : ""}</div>`);
  }

  renderBank(cur, queued = []) {
    const lib = SB.lib;
    if (!lib) { this.setHTML(".bank", `<div class="empty">${T("summoning")}</div>`); return; }
    const ui = this.ui;
    const cats = lib.categories || {};
    const all = lib.sfx;
    const hiddenN = all.filter((s) => SB.isHidden(s.id)).length;
    const downN = all.filter((s) => SB.marks(s.id).down).length;
    const showHidden = ui.showHidden;
    const visible = all.filter((s) => showHidden || !SB.isHidden(s.id));
    const favN = visible.filter((s) => SB.marks(s.id).fav).length;
    const catIds = [...new Set(all.map((s) => s.category))].sort((a, b) =>
      (cats[a]?.order ?? 99) - (cats[b]?.order ?? 99) || a.localeCompare(b));
    const counts = {};
    for (const s of visible) counts[s.category] = (counts[s.category] || 0) + 1;
    this.setHTML(".bank-tools", `
      <div class="search"><ha-icon icon="mdi:magnify"></ha-icon><input type="search" placeholder="${T("search_n", visible.length)}" value="${esc(ui.filter)}" data-act="filter" aria-label="${T("search")}"></div>
      <div class="seg" role="group" aria-label="${T("tap_does")}">${[["queue", "mdi:playlist-plus", T("mode_play"), T("mode_play_t")], ["preview", "mdi:headphones", T("mode_preview"), T("mode_preview_t")]]
        .map(([k, ic, l, tt]) => `<button class="${ui.tapMode === k ? "on" : ""}" data-act="mode" data-mode="${k}" title="${tt}"><ha-icon icon="${ic}"></ha-icon> ${l}</button>`).join("")}</div>
      ${this.config.guest || !hiddenN ? "" : `<label class="tog sm" title="${T("show_hidden_t")}">
        <input type="checkbox" data-act="showhidden" ${showHidden ? "checked" : ""}> ${T("show_hidden")} <small class="muted">${hiddenN}${downN ? ` · ${downN} 👎` : ""}</small></label>`}`);
    if (ui.category === "fav" && !favN) ui.category = "all";
    this.setHTML(".cats", [`<button class="chip cat ${ui.category === "all" ? "on" : ""}" data-act="cat" data-id="all">${T("all_c")} <small>${visible.length}</small></button>`]
      .concat(favN ? [`<button class="chip cat fav-chip ${ui.category === "fav" ? "on" : ""}" data-act="cat" data-id="fav"><ha-icon icon="mdi:heart"></ha-icon> ${T("favorites")} <small>${favN}</small></button>`] : [])
      .concat(catIds.filter((c) => counts[c]).map((c) => `<button class="chip cat ${ui.category === c ? "on" : ""}" data-act="cat" data-id="${esc(c)}">
        ${cats[c]?.emoji || CAT_EMOJI[c] || "🎵"} ${esc(catName(cats, c))} <small>${counts[c]}</small></button>`)).join(""));
    const f = ui.filter.trim().toLowerCase();
    const shown = SB.favFirst(visible).filter((s) => (ui.category === "all" || s.category === ui.category || (ui.category === "fav" && SB.marks(s.id).fav))
      && (!f || s.title.toLowerCase().includes(f) || (s.title_fr || "").toLowerCase().includes(f) || s.category.includes(f) || catName(cats, s.category).toLowerCase().includes(f) || (s.description || "").toLowerCase().includes(f)));
    const byCat = ui.category === "all" && !f;
    const qn = {};
    for (const id of queued) qn[id] = (qn[id] || 0) + 1;
    let html = "";
    let k = 0;
    // a div, not a button: the heart / thumb / eye / aim inside are buttons of their own
    const tile = (s) => `<div class="tile ${this.markClass(s.id)} ${cur?.id === s.id ? "now" : ""}" role="button" tabindex="0" data-act="sound" data-id="${esc(s.id)}"
        style="--i:${Math.min(k++, 40)}" title="${esc(s.description || ttl(s))}${s.source_url ? `\n${s.source_url}` : ""}">
        ${qn[s.id] ? `<span class="t-q" title="${T("queued")}">${qn[s.id]}</span>` : ""}
        <span class="t-e">${cats[s.category]?.emoji || CAT_EMOJI[s.category] || "🎵"}</span>
        <span class="t-n">${esc(ttl(s))}</span>${this.icons(s.id, fmtDur(s.duration), true)}</div>`;
    if (byCat) {
      for (const c of catIds) {
        const list = shown.filter((s) => s.category === c);
        if (!list.length) continue;
        html += `<div class="cat-h"><span>${cats[c]?.emoji || CAT_EMOJI[c] || "🎵"}</span> ${esc(catName(cats, c))}</div><div class="tiles">${list.map(tile).join("")}</div>`;
      }
    } else {
      html = `<div class="tiles">${shown.map(tile).join("")}</div>`;
    }
    this.setHTML(".bank", html || `<div class="empty">${T("no_match")}</div>`);
    if (!this._intro && html) {
      this._intro = true;
      const bank = this.$(".bank");
      bank.classList.add("intro");
      setTimeout(() => bank.classList.remove("intro"), 1200);
    }
  }

  // "play now" picker: a sound straight to chosen speakers, mixed over what they play
  renderAim() {
    const box = this.$(".aim");
    const s = this.ui.aim && SB.lib?.sfx.find((x) => x.id === this.ui.aim);
    box.hidden = !s;
    if (!s) return;
    const me = "browser:" + SB.deviceId;
    const pick = new Set(this.ui.aimSpk || SB.state.settings.sfx.speakers);
    const outs = [...SB.state.outputs.filter((o) => o.available || o.id === me)];
    if (!outs.some((o) => o.id === me)) outs.push({ id: me, name: SB.deviceName, group: "outdoor", kind: "browser", available: true });
    const chip = (o) => `<button class="chip ${pick.has(o.id) ? "on" : ""}" data-act="aimspk" data-id="${esc(o.id)}">
        <ha-icon icon="${KIND_ICON[o.kind] || "mdi:speaker"}"></ha-icon>${esc(o.id === me ? T("this_device") : o.name)}</button>`;
    this.setHTML(".aim", `<div class="aim-card" role="dialog" aria-modal="true">
      <div class="aim-h">${esc(T("aim_title", ttl(s)))}</div>
      <div class="hint">${T("aim_hint")}</div>
      ${[["devices", T("devices")], ["outdoor", T("outdoor")], ["indoor", T("indoor")]].map(([g, label]) => {
        const list = this.groupOuts(outs, g);
        return list.length ? `<div class="aim-g">${g === "devices" ? "" : `<span class="lbl">${label}</span>`}<div class="chips">${list.map(chip).join("")}</div></div>` : "";
      }).join("")}
      <div class="ctl-line"><button class="btn primary" data-act="aimgo" ${pick.size ? "" : "disabled"}><ha-icon icon="mdi:play"></ha-icon> ${T("play_now")}</button>
        <button class="btn" data-act="aimx">${T("cancel")}</button></div></div>`);
  }

  markClass(id) {
    const m = SB.marks(id);
    return `${SB.isHidden(id) ? "hidden-s" : ""} ${m.fav ? "is-fav" : ""} ${m.down ? "is-down" : ""}`;
  }

  // duration / heart / thumb-down / eye (/ aim) row shared by effect tiles and music rows
  icons(id, dur, sfx) {
    const aim = sfx && !this.config.guest && !this.config.standalone
      ? `<button class="ic aim-b" data-act="aim" data-id="${esc(id)}" title="${T("aim")}" aria-label="${T("aim")}"><ha-icon icon="mdi:target"></ha-icon></button>` : "";
    if (this.config.guest) return `<span class="t-row"><span class="t-d">${dur}</span>${aim}</span>`;
    const m = SB.marks(id), hid = SB.isHidden(id);
    const b = (act, icon, on, label) => `<button class="ic ${act} ${on ? "on" : ""}" data-act="${act}" data-id="${esc(id)}" title="${label}" aria-label="${label}"><ha-icon icon="${icon}"></ha-icon></button>`;
    return `<span class="t-row"><span class="t-d">${dur}</span>
      ${b("fav", m.fav ? "mdi:heart" : "mdi:heart-outline", m.fav, m.fav ? T("fav_rm") : T("fav_add"))}
      ${b("down", m.down ? "mdi:thumb-down" : "mdi:thumb-down-outline", m.down, m.down ? T("down_rm") : this.config.standalone ? T("down_add_pub") : T("down_add"))}
      ${b("eye", hid ? "mdi:eye-off" : "mdi:eye", hid, hid ? T("unhide") : T("hide"))}${aim}</span>`;
  }

  // ----- events -----
  speakersFor(panel) { return [...SB.state.settings[panel].speakers]; }

  onClick(e) {
    const h2 = e.target.closest(".sec-h");
    if (h2) {
      const sec = h2.parentElement.dataset.sec;
      this.ui.collapsed[sec] = !this.ui.collapsed[sec];
      LS("collapsed", this.ui.collapsed);
      this.update();
      return;
    }
    if (e.target.closest(".lock")) { SB.unlock(); return; }
    if (e.target === this.$(".aim")) { this.ui.aim = null; this.update(); return; } // backdrop
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled || b.tagName === "INPUT") return;
    const a = b.dataset.act, st = SB.state;
    if (!st) return;
    const outsIn = (g) => {
      const outs = [...st.outputs];
      if (!outs.some((o) => o.id === "browser:" + SB.deviceId)) outs.push({ id: "browser:" + SB.deviceId, kind: "browser", available: true });
      return this.groupOuts(outs, g).map((o) => o.id);
    };
    switch (a) {
      case "theme": SB.patch({ theme: b.dataset.id }); break;
      case "lang": LS("lang", b.dataset.id); setLang(b.dataset.id); SB.ws({ type: "soundboard/lang", lang: b.dataset.id });
        this.dispatchEvent(new CustomEvent("soundboard-lang", { detail: { lang: b.dataset.id }, bubbles: true, composed: true }));
        SB.render(true); break;
      case "tab":
        this.ui.tab = b.dataset.tab; LS("tab", this.ui.tab); this.update();
        // the bar is sticky: bring the top of the new tab into view, not the middle of the old one
        { const bar = this.$(".bar");
          if (bar.getBoundingClientRect().top <= parseFloat(getComputedStyle(bar).top) + 1) this.$(".top").scrollIntoView({ block: "start", behavior: "smooth" }); }
        break;
      case "warm": SB.ws({ type: "soundboard/warm", on: !st.warm }); break;
      case "stopall": SB.stopLocalSfx(); SB.ws({ type: "soundboard/stop_all" }); break;
      case "mplay": SB.ws({ type: "soundboard/music", action: "play" }); break;
      case "mnext": SB.ws({ type: "soundboard/music", action: "next" }); break;
      case "mstop": SB.ws({ type: "soundboard/music", action: "stop" }); break;
      case "spk": {
        const p = b.dataset.panel, id = b.dataset.id, cur = this.speakersFor(p);
        const next = cur.includes(id) ? cur.filter((x) => x !== id) : cur.concat(id);
        if (id.startsWith("browser:")) SB.unlock();
        SB.patch({ [p]: { speakers: next } });
        break;
      }
      case "grpall": case "grpnone": {
        const p = b.dataset.panel, g = outsIn(b.dataset.group);
        const cur = this.speakersFor(p).filter((x) => !g.includes(x));
        SB.patch({ [p]: { speakers: a === "grpall" ? cur.concat(g) : cur } });
        break;
      }
      case "haunt": break; // a checkbox: see onChange
      case "hfavs": SB.patch({ haunt: { favs: !st.settings.haunt.favs } }); break;
      case "hcat": SB.patch({ haunt: { cats: this.toggleIn(st.settings.haunt.cats, b.dataset.id) } }); break;
      case "mcam": SB.patch({ motion: { cams: this.toggleIn(st.settings.motion.cams, b.dataset.id) } }); break;
      case "aim": e.preventDefault(); SB.unlock(); this.ui.aim = b.dataset.id; this.update(); break;
      case "aimspk": {
        const cur = new Set(this.ui.aimSpk || st.settings.sfx.speakers);
        if (cur.has(b.dataset.id)) cur.delete(b.dataset.id); else cur.add(b.dataset.id);
        this.ui.aimSpk = [...cur]; LS("aim_speakers", this.ui.aimSpk); this.update();
        break;
      }
      case "aimgo": {
        const speakers = this.ui.aimSpk || st.settings.sfx.speakers;
        SB.ws({ type: "soundboard/play_now", sound: this.ui.aim, speakers, theme: SB.libTheme });
        this.ui.aim = null; this.update();
        break;
      }
      case "aimx": this.ui.aim = null; this.update(); break;
      case "papply": this.applyPreset(b.dataset.id); break;
      case "psave": {
        const name = (prompt(T("preset_name")) || "").trim().slice(0, 40);
        if (name) SB.ws({ type: "soundboard/preset", action: "save", name });
        break;
      }
      case "pdel": {
        const p = (st.presets || []).find((x) => x.id === b.dataset.id);
        if (p && confirm(T("preset_del", p.name))) SB.ws({ type: "soundboard/preset", action: "delete", preset: p.id });
        break;
      }
      case "dexport": this.exportData(); break;
      case "dimport": this.importData(); break;
      case "dreset":
        if (confirm(T("reset_q"))) SB.ws({ type: "soundboard/data", action: "reset" }).then(() => this.toast(T("reset_done")));
        break;
      case "offline": this.dispatchEvent(new CustomEvent("soundboard-offline", { bubbles: true, composed: true })); break;
      case "addpause": SB.ws({ type: "soundboard/queue", action: "add", items: [{ type: "pause", duration: st.settings.sfx.pause_s }] }); break;
      case "pstep": {
        // 1 s steps up to 10 s, then 5 s steps
        const v = st.settings.sfx.pause_s, up = +b.dataset.d > 0;
        SB.patch({ sfx: { pause_s: Math.min(120, Math.max(1, up ? (v < 10 ? v + 1 : v + 5) : (v <= 10 ? v - 1 : v - 5))) } });
        break;
      }
      case "qplay": SB.ws({ type: "soundboard/queue", action: "play" }); break;
      case "qskip": SB.ws({ type: "soundboard/queue", action: "skip" }); break;
      case "qstop": SB.ws({ type: "soundboard/queue", action: "stop" }); break;
      case "qclear": SB.ws({ type: "soundboard/queue", action: "clear" }); break;
      case "qrm": SB.ws({ type: "soundboard/queue", action: "remove", uid: b.dataset.uid }); break;
      case "mode": this.ui.tapMode = b.dataset.mode; this.update(); break;
      case "cat": this.ui.category = b.dataset.id; LS("category", this.ui.category); this.update(); break;
      case "sound": this.onSound(b); break;
      case "fav": case "down": e.preventDefault(); SB.toggleMark(b.dataset.id, a); break;
      case "eye": e.preventDefault(); SB.toggleHidden(b.dataset.id); break;
      case "undo": SB.ws({ type: "soundboard/undo", entry: b.dataset.id }); break;
    }
  }

  // "" = all (an empty list); otherwise add / remove id
  toggleIn(list, id) {
    if (!id) return [];
    const s = new Set(list || []);
    if (s.has(id)) s.delete(id); else s.add(id);
    return [...s];
  }

  async exportData() {
    const data = await SB.ws({ type: "soundboard/data", action: "export" });
    if (!data) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
    a.download = `soundboard-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  importData() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json,.json";
    inp.onchange = async () => {
      try {
        const data = JSON.parse(await inp.files[0].text());
        await SB.hass.callWS({ type: "soundboard/data", action: "import", data });
        this.toast(T("imported"));
      } catch (err) {
        this.toast(T("import_failed", err.message || err));
      }
    };
    inp.click();
  }

  onSound(b) {
    const id = b.dataset.id;
    const s = SB.lib.sfx.find((x) => x.id === id);
    if (!s) return;
    b.classList.remove("flash");
    void b.offsetWidth;
    b.classList.add("flash");
    if (navigator.vibrate) navigator.vibrate(8);
    if (this.ui.tapMode === "preview") {
      SB.stopLocalSfx();
      SB.playLocal(s.url, s.gain || 1).catch((e) => console.warn("preview", e));
    } else {
      if (!SB.state.settings.sfx.speakers.length) { this.toast(T("tick_first")); return; }
      SB.ws({ type: "soundboard/queue", action: "add", items: [{ type: "sound", id, theme: SB.libTheme }] });
    }
  }

  onInput(e) {
    const t = e.target;
    const label = (sel, v) => { const el = t.parentElement.querySelector(sel); if (el) el.textContent = v; };
    if (t.dataset.act === "vol") label(".vol-v", `${t.value}%`);
    if (t.dataset.act === "level") label(".lvl-v", `${t.value}%`);
    if (t.dataset.act === "trim") label(".trim-v", `${t.value}%`);
    if (["gap", "mcool", "hmin", "hmax"].includes(t.dataset.act)) { const el = t.nextElementSibling; if (el) el.textContent = `${t.value}s`; }
    if (t.dataset.act === "filter") { this.ui.filter = t.value; clearTimeout(this._ft); this._ft = setTimeout(() => this.update(), 120); }
  }

  onChange(e) {
    const t = e.target, a = t.dataset.act;
    const tracks = () => [...this.shadowRoot.querySelectorAll('input[data-act="track"]')].filter((x) => x.checked).map((x) => x.dataset.id);
    const h = SB.state?.settings.haunt || {};
    switch (a) {
      case "track": SB.patch({ music: { tracks: tracks() } }); break;
      case "mloop": SB.patch({ music: { loop: t.checked } }); break;
      case "mmix": SB.patch({ music: { mix: t.checked } }); break;
      case "level": SB.patch({ music: { levels: { [t.dataset.id]: +t.value / 100 } } }); break;
      case "trim": SB.patch({ trim: { [t.dataset.id]: +t.value / 100 } }); break;
      case "showhidden": this.ui.showHidden = t.checked; LS("show_hidden", t.checked); this.update(); break;
      case "showhiddenmusic": this.ui.showHiddenMusic = t.checked; LS("show_hidden_music", t.checked); this.update(); break;
      case "autoplay": SB.patch({ sfx: { autoplay: t.checked } }); break;
      case "qloop": SB.patch({ sfx: { loop: t.checked } }); break;
      case "gap": SB.patch({ sfx: { gap: +t.value } }); break;
      case "vol": SB.patch({ [t.dataset.panel]: { volume: +t.value / 100 } }); break;
      case "haunt": if (t.checked) SB.unlock(); SB.patch({ haunt: { on: t.checked } }); break;
      case "hmin": SB.patch({ haunt: { min_s: +t.value, max_s: Math.max(+t.value, h.max_s) } }); break;
      case "hmax": SB.patch({ haunt: { max_s: +t.value, min_s: Math.min(+t.value, h.min_s) } }); break;
      case "motion": SB.patch({ motion: { on: t.checked } }); break;
      case "mcool": SB.patch({ motion: { cooldown_s: +t.value } }); break;
    }
  }

  toast(msg) {
    this.dispatchEvent(new CustomEvent("hass-notification", { detail: { message: msg }, bubbles: true, composed: true }));
  }
}

// Always dark, whatever the HA theme: a night scene, candle-lit. Fonts: Pirata One (display) and
// Bricolage Grotesque (text), both SIL OFL, served next to this file (see FONT_CSS).
const STYLE = `
:host { --sb-accent:#ff7518; --sb-accent2:#9b59ff; --ink:#0c0a11; --panel:rgba(26,20,36,.74); --line:rgba(241,232,214,.10);
  --bone:#f1e8d6; --mute:rgba(241,232,214,.62); --ecto:#8dffa6; --blood:#d7263d; --sb-sticky-top:var(--header-height, 0px);
  --display:"SB Display", "Pirata One", Georgia, serif; --text:"SB Body", "Bricolage Grotesque", ui-rounded, "Segoe UI", sans-serif;
  display:block; }
* { box-sizing:border-box; }
.wrap { position:relative; isolation:isolate; max-width:1240px; margin:0 auto; padding:14px; display:flex; flex-direction:column; gap:14px;
  color:var(--bone); font-family:var(--text); color-scheme:dark; border-radius:24px;
  background:
    radial-gradient(900px 420px at 88% -8%, color-mix(in srgb, var(--sb-accent2) 26%, transparent), transparent 70%),
    radial-gradient(700px 380px at -10% 108%, color-mix(in srgb, var(--sb-accent) 16%, transparent), transparent 70%),
    linear-gradient(180deg, #120e19, var(--ink) 40%); }
.wrap.standalone { border-radius:0; min-height:100vh; --sb-sticky-top:0px; }
.fog { position:absolute; inset:0; z-index:-1; border-radius:inherit; pointer-events:none; opacity:.9;
  background:
    radial-gradient(40% 18% at 20% 30%, rgba(200,200,235,.11), transparent 70%),
    radial-gradient(35% 14% at 70% 60%, rgba(200,200,235,.09), transparent 70%),
    radial-gradient(45% 20% at 40% 85%, rgba(200,200,235,.08), transparent 70%);
  background-size:200% 100%; animation:fog 26s ease-in-out infinite alternate; }
/* now and then, lightning over the whole scene */
.flash-sky { position:absolute; inset:0; z-index:-1; border-radius:inherit; pointer-events:none; opacity:0;
  background:radial-gradient(120% 60% at 70% 0%, rgba(200,215,255,.55), rgba(200,215,255,.08) 60%, transparent);
  animation:lightning 17s infinite; }
@keyframes lightning { 0%, 90%, 100% { opacity:0; } 90.6% { opacity:.9; } 91.2% { opacity:.1; } 91.8% { opacity:.65; } 93% { opacity:0; } }
/* a few bats crossing the header */
/* the moon, and bats crossing it: each bat drifts across (left), rises and dips on a slow wave
   with a tilt (.bob), and beats its wings around the shoulders: bursts of flaps, then a glide */
.bats { position:absolute; left:0; right:0; top:0; height:170px; overflow:hidden; pointer-events:none; z-index:0; border-radius:24px 24px 0 0; }
.moon { position:absolute; right:22%; top:12px; width:74px; height:74px; border-radius:50%;
  background:radial-gradient(circle at 38% 36%, #fff6dc, #f1dca8 55%, #d6b979);
  box-shadow:0 0 30px 8px rgba(255,228,170,.35), 0 0 90px 30px rgba(255,200,120,.12); opacity:.9; }
.moon::after { content:""; position:absolute; inset:0; border-radius:50%;
  background:radial-gradient(circle at 64% 60%, rgba(150,120,70,.35) 0 9%, transparent 10%), radial-gradient(circle at 34% 68%, rgba(150,120,70,.25) 0 6%, transparent 7%),
    radial-gradient(circle at 58% 26%, rgba(150,120,70,.22) 0 5%, transparent 6%); }
.bat { position:absolute; left:-90px; width:var(--w); animation:bat-x var(--t) linear infinite; animation-delay:var(--d); }
.bat .bob { display:block; animation:bat-bob var(--b) ease-in-out infinite alternate; }
.bat svg { display:block; width:100%; fill:#0d0812; filter:drop-shadow(0 0 4px rgba(205,165,255,.95)) drop-shadow(0 0 10px rgba(155,89,255,.45)); overflow:visible; }
.bat .wl, .bat .wr { transform-box:view-box; animation:flap-l var(--f) ease-in-out infinite; transform-origin:47px 18px; }
.bat .wr { animation-name:flap-r; transform-origin:53px 18px; }
.b1 { --w:64px; --t:15s; --d:-2s; --b:2.4s; --f:1.7s; top:20px; }
.b2 { --w:38px; --t:22s; --d:-9s; --b:3.1s; --f:1.4s; top:64px; opacity:.85; }
.b3 { --w:28px; --t:29s; --d:-20s; --b:2.7s; --f:1.2s; top:36px; opacity:.7; }
.b4 { --w:48px; --t:19s; --d:-13s; --b:2.2s; --f:1.9s; top:92px; animation-direction:reverse; }
.b4 svg { transform:scaleX(-1); }
@keyframes bat-x { from { left:-90px; } to { left:calc(100% + 90px); } }
@keyframes bat-bob { from { transform:translateY(-16px) rotate(-7deg); } to { transform:translateY(14px) rotate(6deg); } }
/* five quick beats (wings up, then down and foreshortened), then a glide with the wings held out */
@keyframes flap-l { 0%, 20%, 40%, 60%, 80% { transform:rotate(26deg) scaleY(1); } 10%, 30%, 50%, 70% { transform:rotate(-24deg) scaleY(.55); } 88%, 100% { transform:rotate(4deg) scaleY(.95); } }
@keyframes flap-r { 0%, 20%, 40%, 60%, 80% { transform:rotate(-26deg) scaleY(1); } 10%, 30%, 50%, 70% { transform:rotate(24deg) scaleY(.55); } 88%, 100% { transform:rotate(-4deg) scaleY(.95); } }
.top { position:relative; z-index:1; }
.fog::after { content:""; position:absolute; inset:0; border-radius:inherit; opacity:.07; mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
@keyframes fog { from { background-position:0% 0%; } to { background-position:100% 0%; } }
button { font:inherit; color:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent; }
button:focus-visible, .tile:focus-visible, input:focus-visible { outline:2px solid var(--sb-accent); outline-offset:2px; }
ha-icon { --mdc-icon-size:18px; }
.top { display:flex; flex-wrap:wrap; align-items:center; gap:12px; padding:8px 6px 2px; }
.brand { display:flex; align-items:center; gap:14px; margin-right:auto; }
.brand .emoji { font-size:46px; line-height:1; filter:drop-shadow(0 0 18px color-mix(in srgb, var(--sb-accent) 70%, transparent)); animation:bob 5s ease-in-out infinite; }
@keyframes bob { 50% { transform:translateY(-4px) rotate(-4deg); } }
.title { font-family:var(--display); font-size:46px; line-height:.95; letter-spacing:.01em; color:#ffe9c7;
  text-shadow:0 0 18px color-mix(in srgb, var(--sb-accent) 65%, transparent), 0 2px 0 #000; animation:candle 4s infinite; }
@keyframes candle { 0%,100% { opacity:1; } 42% { opacity:.93; } 44% { opacity:1; } 71% { opacity:.96; } }
.subtitle { font-size:12px; color:var(--mute); letter-spacing:.22em; text-transform:uppercase; margin-top:6px; }
.themes { display:flex; gap:6px; flex-wrap:wrap; }
.bar { position:sticky; top:var(--sb-sticky-top); z-index:5; display:grid; grid-template-columns:1fr 1fr auto; gap:8px; padding:8px;
  border-radius:20px; border:1px solid var(--line); background:rgba(12,10,17,.86); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
  box-shadow:0 12px 30px -18px #000; }
.tab { border:1px solid var(--line); background:rgba(255,255,255,.035); border-radius:14px; padding:8px 6px; display:flex; flex-direction:column; align-items:center; gap:1px; min-width:0; transition:background .2s, border-color .2s, box-shadow .2s; }
.tab-l { font-weight:750; font-size:15px; white-space:nowrap; }
.tab-sub { font-size:11.5px; color:var(--mute); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
.tab.on { border-color:var(--sb-accent); background:linear-gradient(180deg, color-mix(in srgb, var(--sb-accent) 26%, transparent), color-mix(in srgb, var(--sb-accent) 8%, transparent));
  box-shadow:0 0 22px -8px var(--sb-accent), inset 0 1px 0 rgba(255,255,255,.12); }
.tab.on .tab-sub { color:var(--bone); }
.stopall { border:0; border-radius:14px; padding:0 16px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; font-size:13px;
  background:linear-gradient(180deg, #e63950, #a3162a); color:#fff; display:flex; gap:6px; align-items:center; justify-content:center;
  box-shadow:0 6px 18px -8px var(--blood), inset 0 1px 0 rgba(255,255,255,.25); }
.stopall.live { animation:throb 1.6s ease-in-out infinite; }
@keyframes throb { 50% { box-shadow:0 0 0 4px color-mix(in srgb, var(--blood) 35%, transparent), 0 6px 18px -8px var(--blood); } }
.stopall:active { transform:scale(.96); }
/* floats over the page: it disappears on the first tap, and a banner in the flow would shift
   everything under the finger between pointerdown and click, so that tap would miss its button */
.lock { position:fixed; z-index:20; left:50%; bottom:max(16px, env(safe-area-inset-bottom)); transform:translateX(-50%); width:min(calc(100% - 32px), 520px);
  padding:14px; border-radius:16px; background:linear-gradient(90deg, var(--sb-accent), color-mix(in srgb, var(--sb-accent) 70%, #ffd27a)); color:#1a0f00;
  font-weight:700; text-align:center; cursor:pointer; box-shadow:0 10px 40px -8px #000, 0 0 30px -10px var(--sb-accent); animation:rise .4s both; }
.sec { background:var(--panel); border-radius:22px; border:1px solid var(--line); box-shadow:0 20px 40px -30px #000, inset 0 1px 0 rgba(255,255,255,.04); }
.sec.off-tab { display:none; }
.sec-h { margin:0; padding:14px 16px 10px; font-family:var(--display); font-weight:400; font-size:28px; line-height:1; letter-spacing:.01em; display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none; color:#ffe9c7; }
.sec-sub { margin-left:auto; font-family:var(--text); font-size:12px; font-weight:600; color:var(--ecto); max-width:50%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.chev { transition:transform .2s; color:var(--mute); }
.sec.collapsed .chev { transform:rotate(-90deg); }
.sec.collapsed .sec-b { display:none; }
.sec-b { padding:0 16px 16px; display:flex; flex-direction:column; gap:14px; }
.dev-b { padding-top:16px; }
.np:empty { display:none; }
.music-tools { display:flex; justify-content:flex-end; margin:-8px 0 -10px; }
.chip { border:1px solid var(--line); background:rgba(255,255,255,.05); border-radius:999px; padding:7px 13px; display:inline-flex; gap:6px; align-items:center; font-size:13.5px; white-space:nowrap; transition:background .15s, border-color .15s, transform .1s; }
.chip:active { transform:scale(.96); }
.chip.on { background:color-mix(in srgb, var(--sb-accent) 26%, transparent); border-color:var(--sb-accent); font-weight:700; }
.chip.ghost { border-style:dashed; color:var(--mute); }
.chip small { opacity:.65; font-weight:400; }
.warm-row { padding:8px 0 4px; }
.warm.on { background:color-mix(in srgb, var(--ecto) 18%, transparent); border-color:var(--ecto); }
.dot { width:8px; height:8px; border-radius:50%; display:inline-block; flex:none; }
.dot.warm { background:var(--ecto); box-shadow:0 0 8px var(--ecto); }
.dot.connecting { background:#ffb300; animation:blink 1s infinite; }
@keyframes blink { 50% { opacity:.2; } }
.lbl { font-size:11px; text-transform:uppercase; letter-spacing:.14em; color:var(--mute); font-weight:700; }
.presets { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.presets .lbl { width:100%; }
.preset { display:inline-flex; align-items:center; }
.preset .chip { border-color:color-mix(in srgb, var(--sb-accent2) 60%, transparent); background:color-mix(in srgb, var(--sb-accent2) 16%, transparent); }
.px { border:0; background:none; color:var(--mute); font-size:18px; line-height:1; padding:0 4px 0 6px; }
/* one grid for both sliders, so the label column fits the longer label and the sliders line up */
.masters { display:grid; grid-template-columns:auto minmax(0,1fr) 46px; align-items:center; gap:12px 10px; padding:14px; border-radius:16px; background:rgba(0,0,0,.22); border:1px solid var(--line); }
.mvol { display:contents; font-weight:700; }
.masters .hint { grid-column:1 / -1; }
.mvol-l { white-space:nowrap; }
input[type=range] { accent-color:var(--sb-accent); width:100%; min-width:0; cursor:pointer; }
.vol-v, .gap-v, .trim-v, .lvl-v { text-align:right; font-variant-numeric:tabular-nums; font-size:13px; font-weight:600; }
.hint { font-size:12.5px; color:var(--mute); line-height:1.4; }
.dev-t { display:flex; flex-direction:column; }
.dev-row { display:grid; grid-template-columns:minmax(0,1fr) 72px 72px minmax(110px, 26%); align-items:center; gap:6px; padding:3px 0; }
.dev-row.na .dev-n { opacity:.4; text-decoration:line-through; }
.dev-cols { font-size:11.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:8px; color:var(--mute); }
.dev-h { font-size:11px; text-transform:uppercase; letter-spacing:.12em; color:var(--mute); margin-top:10px; }
.dev-n { display:flex; align-items:center; gap:8px; min-width:0; }
.dev-n span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dev-n ha-icon { color:var(--mute); flex:none; }
.tg-h { text-align:center; display:flex; justify-content:center; gap:6px; flex-wrap:wrap; }
.dev-cols .tg-h { flex-direction:column; align-items:center; gap:0; font-size:16px; }
.dev-cols .tg-h small { font-size:10.5px; font-weight:700; }
.chip.tg { justify-content:center; font-size:17px; padding:6px 0; }
.chip.tg:not(.on) { filter:grayscale(1); opacity:.4; }
.trim { display:grid; grid-template-columns:1fr 36px; align-items:center; gap:4px; }
.trim-v { font-size:11.5px; color:var(--mute); }
.trim.cut .trim-v { color:var(--sb-accent); }
.link { border:0; background:none; padding:0; color:var(--sb-accent); font-size:12px; text-decoration:underline; text-underline-offset:2px; text-transform:none; letter-spacing:0; }
.data { display:flex; flex-direction:column; gap:8px; padding-top:4px; }
.via-b { display:flex; align-items:center; gap:8px; width:100%; border:1px dashed var(--line); border-radius:12px; background:rgba(0,0,0,.18); padding:9px 12px; font-size:13px; text-align:left; color:var(--mute); }
.via-b span:first-of-type { flex:1; color:var(--bone); }
.via-b.warn { border-color:#ffb300; background:color-mix(in srgb, #ffb300 12%, transparent); }
.row.ctl, .ctl-line { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
.row.ctl.fx-ctl { flex-direction:column; align-items:stretch; gap:10px; }
.fx-ctl .ctl-line { justify-content:flex-start; width:100%; }
.opts { border:1px solid var(--line); border-radius:12px; padding:0 12px; background:rgba(0,0,0,.18); }
.opts summary { cursor:pointer; padding:9px 0; font-size:13.5px; font-weight:700; list-style-position:inside; }
.opts summary small { font-weight:500; color:var(--mute); margin-left:6px; }
.opts[open] { padding-bottom:12px; }
.opts .ctl-line + .ctl-line { margin-top:10px; }
.gap span:first-child { font-size:13px; color:var(--mute); }
.gap input { flex:1; }
.btn { border:1px solid var(--line); background:rgba(255,255,255,.06); border-radius:12px; padding:9px 14px; display:inline-flex; gap:6px; align-items:center; font-size:14px; font-weight:600; transition:background .15s, transform .1s; }
.btn:not(.primary):hover:not(:disabled) { background:rgba(255,255,255,.1); }
.btn.primary:hover:not(:disabled) { filter:brightness(1.08); }
.btn.sm { padding:5px 11px; font-size:13px; }
.btn.primary { background:linear-gradient(180deg, color-mix(in srgb, var(--sb-accent) 85%, #ffd27a), var(--sb-accent)); border-color:transparent; color:#1a0f00; font-weight:800; box-shadow:0 8px 20px -10px var(--sb-accent); }
.btn.danger { color:#ff8a98; border-color:color-mix(in srgb, var(--blood) 50%, transparent); }
.btn:disabled { opacity:.35; cursor:default; box-shadow:none; }
.btn:not(:disabled):active { transform:scale(.96); }
.stepper { display:inline-flex; align-items:center; gap:6px; }
.stepper b { min-width:34px; text-align:center; font-variant-numeric:tabular-nums; }
.tog { display:inline-flex; gap:7px; align-items:center; font-size:14px; font-weight:600; user-select:none; cursor:pointer; }
.tog.sm { font-size:13px; font-weight:500; color:var(--mute); }
.tog input, .track input { accent-color:var(--sb-accent); width:18px; height:18px; }
.tracks { display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:4px 12px; }
.track-w { display:flex; flex-direction:column; border-radius:12px; border:1px solid transparent; }
.track-w.sel { background:color-mix(in srgb, var(--sb-accent) 9%, transparent); border-color:color-mix(in srgb, var(--sb-accent) 35%, transparent); }
.track { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:12px; cursor:pointer; }
.track:hover { background:rgba(255,255,255,.04); }
.track.playing .t-title { color:var(--ecto); }
.t-title { flex:1; font-weight:600; }
.dur { font-size:12px; color:var(--mute); font-variant-numeric:tabular-nums; }
.np { display:flex; flex-direction:column; gap:4px; padding:10px 12px; border-radius:14px; background:rgba(0,0,0,.25); border:1px solid color-mix(in srgb, var(--ecto) 25%, transparent); }
.np-row { display:flex; align-items:center; gap:10px; font-weight:700; }
.np-t { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.bar-p { height:4px; border-radius:2px; background:rgba(255,255,255,.08); overflow:hidden; margin:2px 0 6px; }
.fill, .q-bar { display:block; height:100%; background:var(--ecto); transform-origin:left; animation-name:prog; animation-timing-function:linear; animation-fill-mode:both; }
@keyframes prog { from { transform:scaleX(0); } to { transform:scaleX(1); } }
.eq { display:inline-flex; gap:2px; align-items:flex-end; height:14px; }
.eq i { width:3px; background:var(--ecto); animation:eq .9s infinite ease-in-out; border-radius:1px; }
.eq i:nth-child(2) { animation-delay:-.3s; } .eq i:nth-child(3) { animation-delay:-.6s; }
@keyframes eq { 0%,100% { height:4px; } 50% { height:14px; } }
.queue { min-height:20px; }
.q-items { display:flex; flex-wrap:wrap; gap:6px; }
.q { position:relative; display:inline-flex; align-items:center; gap:4px; padding:6px 4px 6px 10px; border-radius:12px; background:rgba(255,255,255,.05); border:1px solid var(--line); font-size:13px; overflow:hidden; max-width:220px; }
.q.done { opacity:.4; }
.q-spin { width:12px; height:12px; border-radius:50%; border:2px solid color-mix(in srgb, var(--sb-accent) 30%, transparent); border-top-color:var(--sb-accent); animation:sbspin .8s linear infinite; flex:none; }
@keyframes sbspin { to { transform:rotate(360deg); } }
.q.error { border-color:var(--blood); }
.q.cur { border-color:var(--ecto); box-shadow:0 0 14px -4px var(--ecto); }
.q-t { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.q-n { font-size:11px; opacity:.6; }
.q-x { border:0; background:none; font-size:16px; line-height:1; padding:0 6px; opacity:.6; }
.q-bar { position:absolute; left:0; bottom:0; height:3px; width:100%; }
.gapchip { border-style:dashed; }
.bank-tools { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.seg { display:inline-flex; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
.seg button { border:0; background:rgba(255,255,255,.04); padding:8px 11px; display:inline-flex; gap:5px; align-items:center; font-size:13px; font-weight:600; }
.seg button + button { border-left:1px solid var(--line); }
.seg button.on { background:var(--sb-accent); color:#1a0f00; font-weight:800; }
.search { flex:1 1 220px; display:flex; align-items:center; gap:6px; border:1px solid var(--line); border-radius:12px; padding:0 12px; background:rgba(0,0,0,.3); }
.search:focus-within { border-color:var(--sb-accent); }
.search ha-icon { color:var(--mute); }
.search input { flex:1; border:0; background:none; color:inherit; font:inherit; padding:10px 0; outline:none; min-width:0; }
.cats { display:flex; gap:6px; overflow-x:auto; padding:2px 2px 6px; scrollbar-width:thin; scroll-snap-type:x proximity; -webkit-mask-image:linear-gradient(90deg, #000 92%, transparent); mask-image:linear-gradient(90deg, #000 92%, transparent); }
.cats .chip { scroll-snap-align:start; }
.cat-h { font-family:var(--display); font-size:22px; margin:12px 0 8px; color:#ffe9c7; display:flex; align-items:center; gap:8px; }
.cat-h span { font-size:18px; }
.tiles { display:grid; grid-template-columns:repeat(auto-fill, minmax(124px, 1fr)); gap:10px; }
.tile { position:relative; border:1px solid var(--line); border-radius:18px; padding:12px 6px 5px; min-height:108px; cursor:pointer;
  background:linear-gradient(165deg, rgba(255,255,255,.075), rgba(255,255,255,.015) 60%), color-mix(in srgb, var(--sb-accent2) 7%, #15111c);
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; text-align:center; user-select:none; touch-action:manipulation;
  transition:transform .14s ease, border-color .2s, box-shadow .25s; }
/* the tiles rise in once, when the bank first shows; not on every re-render (each queue change re-renders it) */
.bank.intro .tile { animation:rise .5s both; animation-delay:calc(var(--i, 0) * 14ms); }
@keyframes rise { from { opacity:0; transform:translateY(8px); } }
.tile:hover { border-color:color-mix(in srgb, var(--sb-accent) 70%, transparent); box-shadow:0 14px 28px -16px var(--sb-accent); transform:translateY(-2px); }
.tile:active { transform:scale(.95); }
.tile.flash { animation:flash .5s ease-out; }
@keyframes flash { 0% { box-shadow:0 0 0 0 var(--sb-accent); background:color-mix(in srgb, var(--sb-accent) 40%, #15111c); } 100% { box-shadow:0 0 0 14px transparent; } }
.tile.now { border-color:var(--ecto); box-shadow:0 0 0 1px var(--ecto), 0 0 28px -6px var(--ecto); }
.tile.now .t-e { animation:haunt .9s ease-in-out infinite; }
@keyframes haunt { 50% { transform:scale(1.15) rotate(-6deg); } }
.t-q { position:absolute; top:6px; right:8px; min-width:18px; height:18px; padding:0 5px; border-radius:9px; background:var(--sb-accent); color:#1a0f00; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; }
.t-e { font-size:32px; line-height:1; filter:drop-shadow(0 6px 10px rgba(0,0,0,.55)); transition:transform .2s; }
.tile:hover .t-e { transform:scale(1.12) rotate(-6deg); }
.t-n { font-size:13px; line-height:1.2; font-weight:650; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.t-d { font-size:11px; color:var(--mute); }
.tile.hidden-s, .track.hidden-s { opacity:.45; border-style:dashed; }
.tile.is-down { border-color:var(--blood); }
.tile.is-fav { border-color:color-mix(in srgb, #ff4d8d 55%, var(--line)); }
.t-row { display:flex; align-items:center; justify-content:center; gap:1px; margin-top:2px; }
.track .t-row { margin:0; }
.ic { border:0; background:none; padding:3px; border-radius:8px; line-height:0; opacity:.38; display:inline-flex; }
.ic ha-icon { --mdc-icon-size:16px; }
.ic:hover { opacity:.9; background:rgba(255,255,255,.08); }
.ic.on { opacity:1; }
.ic.fav.on { color:#ff4d8d; }
.ic.down.on { color:var(--blood); }
.t-row .t-d { min-width:26px; text-align:center; margin-right:2px; }
.fav-chip ha-icon { color:#ff4d8d; --mdc-icon-size:16px; }
.muted { opacity:.6; }
.empty { color:var(--mute); font-size:13.5px; padding:6px 0; }
.lvl { display:grid; grid-template-columns:18px 1fr 44px; align-items:center; gap:8px; padding:0 10px 8px 38px; }
.lvl ha-icon { --mdc-icon-size:16px; color:var(--mute); }
.hist-list { display:flex; flex-direction:column; max-height:360px; overflow-y:auto; }
.h-row { display:flex; align-items:center; gap:10px; padding:7px 2px; border-bottom:1px solid var(--line); font-size:13px; }
.h-row.undone .h-x { text-decoration:line-through; opacity:.6; }
.h-t { color:var(--mute); font-variant-numeric:tabular-nums; white-space:nowrap; }
.h-who { color:var(--mute); white-space:nowrap; }
.h-x { flex:1; min-width:0; }
.h-tag { font-size:11px; color:var(--mute); }
@media (min-width: 900px) {
  .tiles { grid-template-columns:repeat(auto-fill, minmax(136px, 1fr)); }
  .sec.dev .sec-b { max-width:760px; }
}
@media (max-width: 520px) {
  .wrap { padding:8px; gap:10px; border-radius:18px; }
  .title { font-size:38px; }
  .brand .emoji { font-size:38px; }
  .bar { padding:6px; gap:6px; border-radius:16px; }
  .tab-l { font-size:14px; }
  .stopall { padding:0 11px; }
  .stopall span { display:none; }
  .stopall ha-icon { --mdc-icon-size:24px; }
  .tiles { grid-template-columns:repeat(auto-fill, minmax(102px, 1fr)); gap:7px; }
  .tile { min-height:98px; border-radius:16px; }
  .ic { padding:4px; }
  .sec-b { padding:0 12px 14px; }
  .sec-h { padding:12px 12px 8px; font-size:25px; }
  .dev-row { grid-template-columns:minmax(0,1fr) 42px 42px 84px; gap:4px; }
  .dev-cols .tg-h small { display:none; }
  .fx-ctl .bt { display:none; }
  .fx-ctl .ctl-line:first-child { flex-wrap:nowrap; }
  .trim { grid-template-columns:1fr 30px; gap:2px; }
  .trim-v { font-size:10.5px; }
}
.chips { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.tog.big { font-size:16px; font-weight:800; }
.haunt-in, .motion { display:flex; flex-direction:column; gap:8px; padding:12px 14px; border-radius:14px; border:1px solid var(--line); background:rgba(0,0,0,.2); transition:border-color .3s, box-shadow .3s; }
.haunt-in.on, .motion.on { border-color:var(--ecto); box-shadow:0 0 26px -12px var(--ecto); }
.haunt-in.on .tog.big { color:var(--ecto); }
.h-opts summary { cursor:pointer; font-size:13.5px; font-weight:700; padding:2px 0; }
.h-opts[open] { display:flex; flex-direction:column; gap:10px; }
.h-opts .ctl-line { flex-wrap:wrap; }
.h-opts .gap input { flex:1 1 90px; }
.aim { position:fixed; inset:0; z-index:30; background:rgba(5,3,8,.62); backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; padding:16px; }
.aim[hidden] { display:none; }
.aim-card { width:min(100%, 540px); background:#18121f; border:1px solid var(--line); border-radius:20px; padding:18px; display:flex; flex-direction:column; gap:12px; box-shadow:0 30px 80px -20px #000, 0 0 40px -20px var(--sb-accent); animation:rise .25s both; }
.aim-h { font-family:var(--display); font-size:26px; color:#ffe9c7; line-height:1.1; }
.ic.aim-b { color:var(--sb-accent); }
.langs { display:flex; gap:4px; }
.chip.lang { padding:5px 10px; font-weight:800; font-size:12px; }
.offline { align-self:flex-start; }
.offline.done { border-color:var(--ecto); color:var(--ecto); }
.aim-g { display:flex; flex-direction:column; gap:6px; }
`;

if (!customElements.get("soundboard-card")) {
  customElements.define("soundboard-card", SoundboardCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "soundboard-card", name: "Soundboard", description: "Themed music + sound-effect queue for the house speakers." });
}
