// Soundboard card: themed background music + a sound-effect queue across the house speakers.
// Served by the soundboard integration (custom_components/soundboard), which owns all playback;
// this file is UI plus the "This device" speaker (a phone/tablet, e.g. paired to a Bluetooth speaker).
//
// Themes are data: the library (theme.json) gives the name, colours, categories, French names,
// a "look" (the scene drawn behind the card, its palette and display font, see LOOKS) and the
// few words that change with the theme (`words`, over I18N). Nothing here is theme-specific
// except the looks themselves.

// categories a theme.json doesn't describe (audio dropped into a folder of its own)
const CAT_EMOJI = { ambience: "🌫️", other: "🎵" };
// The card's fonts sit next to it (www/fonts/, SIL OFL); @font-face only works in the document,
// so each look's display font is declared there the first time that look is shown.
const FONT_BASE = new URL("fonts/", import.meta.url).href;
const fontFace = (id, css) => {
  if (document.getElementById(id)) return;
  const f = document.createElement("style");
  f.id = id;
  f.textContent = css;
  document.head.appendChild(f);
};
fontFace("soundboard-fonts", `@font-face{font-family:"SB Body";src:url(${FONT_BASE}bricolage-grotesque.woff2) format("woff2");font-weight:200 800;font-display:swap}`);
const KIND_ICON = { camera: "mdi:cctv", cast: "mdi:speaker", sonos: "mdi:soundbar", browser: "mdi:cellphone-sound", bluetooth: "mdi:speaker" };
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
    stop_all: "Stop all", stop_all_t: "Stop everything, everywhere (random mode and motion triggers too)",
    lock_house: "🔈 Tap here to enable sound on this device", lock_public: "🔈 Tap anywhere to turn the sound on",
    sfx: "Sound effects", bg: "🎼 Background", hist: "🕯️ History",
    playing: "▶ playing", queued_n: (n) => `${n} queued`, mixed_n: (n) => `${n} mixed`,
    show_hidden: "Show hidden", show_hidden_t: "Hidden ones include those marked for deletion (thumbs down)",
    level_t: "100 % = the background volume; up to 150 % to bring a quiet one forward",
    no_tracks: "No background tracks in this theme yet.", tick_tracks: "Tick one or more tracks below.",
    restart: "Restart", play: "Play", stop: "Stop", next_track: "Next track", loop: "Loop", mix: "Mix",
    mix_t: "Play the ticked tracks together, each at its own level: ticked music plays one piece after another, the ambiences all at once over it. While it plays, tick or untick to add or remove one.",
    n_mixed: (n) => `${n} mixed`, n_tracks: (n) => `${n} tracks`,
    undone: "undone", undo: "Undo", hist_empty: "Nothing yet. Hiding, favourites, marks and playback show up here; hide / favourite / mark can be undone.",
    presets: "Presets", apply: "Apply", save_current: "＋ Save current", save_current_t: "Save what is ticked now (speakers, volumes, background tracks and levels) under a name",
    preset_eg: "e.g. “Porch: cameras at 60 %”", delete_preset: (n) => `Delete preset ${n}`,
    background: "Background", effects: "Effects", volume_of: (n) => `${n} volume`,
    hint_public: "Your phone or computer's own volume sets the maximum; these balance the background against the effects.",
    hint_house: "100 % = the ticked speakers at full power. Speakers are turned all the way up while the soundboard uses them, the sliders do the rest, and they get their own volume back afterwards.",
    your_data: "Your data", data_hint: "Favourites, hidden sounds, presets and settings stay in this browser only.",
    export: "Export", import: "Import", reset: "Reset", offline: "Make it work offline", offline_t: "Downloads every sound so the soundboard works without a connection (install it as an app from your browser menu).",
    this_device: "This device", this_device_t: (n) => `${n}: plays on this phone/tablet (pair it with a Bluetooth speaker). Keep this page open.`,
    speakers: "Speakers", level: "Level", level_t2: "This speaker's own level: lower a speaker that is louder than the others",
    devices: "", outdoor: "Outdoor", indoor: "Indoor", all: "all", none: "none", on_x: (a, b) => `${a} on ${b}`, level_of: (n) => `${n} level`,
    instant: "Instant speakers", instant_short: "Instant", instant_t: "Keeps the selected camera and Cast speakers connected so effects start right away instead of after ~10 s. Turns itself off after 6 h. Other announcements on a camera still take over.",
    connecting_n: (n) => `connecting ${n}…`, ready_n: (n) => `${n} ready`, off: "off",
    p_summary: (a, b, c, d, n, mix) => [`🎼 ${a} speakers ${b}%`, `${FX} ${c} speakers ${d}%`, n ? `${n} track${n > 1 ? "s" : ""}${mix ? " mixed" : ""}` : ""].filter(Boolean).join(" · "),
    preset_applied: (n) => `Preset “${n}” applied`, volume: "Volume", n_speakers: (n) => `${n} speaker${n > 1 ? "s" : ""}`, no_speaker: "No speaker ticked yet", change: "change",
    replay_all: "Replay all", play_n: (n) => `Play ${n}`, skip: "Skip", clear: "Clear", clear_t: "Clear the queue",
    q_options: "Queue options", plays_on_tap: "plays on tap", build_then_play: "build then Play", gap_s: (n) => `${n}s gap`,
    play_on_tap: "Play on tap", add_pause: "+ Pause", shorter: "Shorter pause", longer: "Longer pause", gap: "Gap between sounds",
    q_empty_tap: "Tap a sound to play it right away; tap more to line them up.", q_empty_build: "Tap sounds to build a sequence, then press Play.",
    waiting: "Waiting for every speaker to be ready, so they start together… ", pinned: (n) => ` → pinned to ${n} speaker(s)`, remove: "remove", gapw: "gap",
    summoning: "Loading the sounds…", search_n: (n) => `Search ${n} sounds`, search: "Search sounds", tap_does: "What a tap does",
    mode_play: "Play", mode_preview: "Preview here", mode_play_t: "A tap plays it on the speakers (or lines it up)", mode_preview_t: "A tap only plays it here, for you",
    all_c: "All", favorites: "Favorites", no_match: "No sounds match.", queued: "queued",
    fav_add: "Favorite", fav_rm: "Remove from favorites", down_rm: "Unmark (keep it)", down_add_pub: "Dislike (also hides it)", down_add: "Mark for deletion (also hides it)",
    hide: "Hide", unhide: "Unhide", aim: "Play now on chosen speakers", aim_title: (t) => `Play “${t}” now on…`,
    aim_hint: "Not queued: it plays at once on these speakers, mixed over whatever they are playing.", play_now: "Play now", cancel: "Cancel",
    preset_name: "Name this preset (what plays where, volumes, background tracks):", preset_del: (n) => `Delete the preset “${n}”?`,
    reset_q: "Forget every favourite, hidden sound, preset and setting stored in this browser?", reset_done: "Back to a fresh soundboard",
    imported: "Imported", import_failed: (e) => `Import failed: ${e}`, tick_first: "Tick at least one speaker for effects first (Speakers tab)",
    haunt: "Random mode", haunt_hint: (a, b) => `A random sound every ${a} to ${b} s, by itself.`, haunt_opts: "Random mode options",
    haunt_every: "Every", haunt_to: "to", haunt_from: "Pick from", favs_only: "♥ Favourites only", all_cats: "All categories",
    motion: "🏃 Motion triggers", motion_hint: "When a camera sees a person, it plays a random sound (from the random mode's pool) on that camera's speaker.",
    motion_cool: "At most once per camera every", cameras: "Cameras", all_cams: "all",
    voices_t: "Voices: which languages to show", voices_in: (l) => `Spoken in ${LANG_NAME.en[l] || l}`,
    scenes: "🎬 Scenes, one tap", scene_t: (n, d) => `Lines up ${n} sounds (${d}), with their pauses`,
    tab_settings: "🎚️ Settings", bg_music: "🎶 Music", bg_amb: "🌫️ Ambiences",
    bg_music_t: "Ticked pieces play one after another", bg_amb_t: "With Mix on, every ticked ambience plays at once, over the music",
    sung_in: (l) => `Sung in ${LANG_NAME.en[l] || l}`,
    hush: "Hush at the slightest noise",
    hush_hint: (n) => `This device listens with its microphone: at a noise, every sound fades out at once and comes back ${n} s after the last one. Its own sounds don't count. Keep this page open: the screen stays on while it listens.`,
    hush_sens: "Sensitivity", hush_hold: "Quiet for", hush_test: "Test the microphone (30 s)",
    hush_test_t: "Shows for 30 s what the microphone hears and where the line is. Clap, talk, play a sound: a noise that crosses the line is marked.",
    hush_starting: "Opening the microphone…", hush_denied: "The microphone is blocked. Allow it for this site in your browser's settings, then try again.",
    hush_nomic: "No microphone available on this device.", hush_ended: "The microphone stopped (another app took it?). Turn this off and on again.",
    hush_listen: "👂 Listening", hush_heard_ago: (s) => `last noise ${s} ago`, hush_quiet: (n) => `🤫 Heard a noise: sounds back in ${n} s`,
    hush_testing: (n) => `Test: ${n} s left. Clap, talk, play a sound: its own sounds stay under the line.`,
    hush_test_off: "Hush is off: the test only shows what it would do.",
    hush_l_level: "what it hears", hush_l_line: "the line a noise must cross", hush_l_ours: "its own sounds, as heard", hush_l_heard: "noise heard",
    hush_ios: "On iPhone and iPad, Safari may play sound quieter or with crackles while the microphone is open (a Safari bug).",
    hush_l_hushed: "faded out", hush_chart_l: "Microphone level over the last 30 seconds, in dB above the room's quiet",
  },
  fr: {
    sounds_n: (n) => `${n} sons`, soundboard: "Boîte à sons",
    tab_speakers: "🔊 Enceintes", tab_volume: "🎚️ Volume", tab_sounds: "Sons", pick_play: "choisir &amp; jouer", on: "en cours",
    stop_all: "Tout arrêter", stop_all_t: "Tout arrêter, partout (mode aléatoire et déclenchement au mouvement aussi)",
    lock_house: "🔈 Touchez ici pour activer le son sur cet appareil", lock_public: "🔈 Touchez n'importe où pour activer le son",
    sfx: "Effets sonores", bg: "🎼 Fond sonore", hist: "🕯️ Historique",
    playing: "▶ en cours", queued_n: (n) => `${n} en attente`, mixed_n: (n) => `${n} mélangées`,
    show_hidden: "Voir les masqués", show_hidden_t: "Les masqués incluent ceux marqués pour suppression (pouce en bas)",
    level_t: "100 % = le volume du fond sonore ; jusqu'à 150 % pour faire ressortir une piste discrète",
    no_tracks: "Pas encore de fond sonore dans ce thème.", tick_tracks: "Cochez une ou plusieurs pistes ci-dessous.",
    restart: "Relancer", play: "Jouer", stop: "Arrêter", next_track: "Piste suivante", loop: "Boucle", mix: "Mélange",
    mix_t: "Joue les pistes cochées ensemble, chacune à son niveau : la musique cochée passe un morceau après l'autre, les ambiances toutes à la fois par-dessus. Pendant la lecture, cochez ou décochez pour en ajouter ou en retirer.",
    n_mixed: (n) => `${n} mélangées`, n_tracks: (n) => `${n} pistes`,
    undone: "annulé", undo: "Annuler", hist_empty: "Rien pour l'instant. Masquages, favoris, marques et lectures apparaissent ici ; masquer / favori / marque peuvent être annulés.",
    presets: "Préréglages", apply: "Appliquer", save_current: "＋ Enregistrer", save_current_t: "Enregistre ce qui est coché (enceintes, volumes, fond sonore et niveaux) sous un nom",
    preset_eg: "ex. « Entrée : caméras à 60 % »", delete_preset: (n) => `Supprimer le préréglage ${n}`,
    background: "Fond sonore", effects: "Effets", volume_of: (n) => `Volume ${n}`,
    hint_public: "Le volume de votre téléphone ou ordinateur fixe le maximum ; ces curseurs équilibrent le fond sonore et les effets.",
    hint_house: "100 % = les enceintes cochées à pleine puissance. Elles sont montées au maximum pendant que la boîte à sons les utilise, les curseurs font le reste, puis elles retrouvent leur volume.",
    your_data: "Vos données", data_hint: "Favoris, sons masqués, préréglages et réglages restent uniquement dans ce navigateur.",
    export: "Exporter", import: "Importer", reset: "Réinitialiser", offline: "Utiliser hors ligne", offline_t: "Télécharge tous les sons pour que la boîte à sons fonctionne sans connexion (installez-la comme une appli depuis le menu du navigateur).",
    this_device: "Cet appareil", this_device_t: (n) => `${n} : joue sur ce téléphone/cette tablette (reliez-le à une enceinte Bluetooth). Gardez cette page ouverte.`,
    speakers: "Enceintes", level: "Niveau", level_t2: "Le niveau propre de cette enceinte : baissez celle qui est plus forte que les autres",
    devices: "", outdoor: "Extérieur", indoor: "Intérieur", all: "toutes", none: "aucune", on_x: (a, b) => `${a} sur ${b}`, level_of: (n) => `Niveau ${n}`,
    instant: "Enceintes instantanées", instant_short: "Instantanées", instant_t: "Garde les caméras et enceintes Cast sélectionnées connectées pour que les effets démarrent tout de suite au lieu d'environ 10 s. S'éteint après 6 h. Les autres annonces sur une caméra restent prioritaires.",
    connecting_n: (n) => `connexion ${n}…`, ready_n: (n) => `${n} prêtes`, off: "éteint",
    p_summary: (a, b, c, d, n, mix) => [`🎼 ${a} enceintes ${b} %`, `${FX} ${c} enceintes ${d} %`, n ? `${n} piste${n > 1 ? "s" : ""}${mix ? " mélangées" : ""}` : ""].filter(Boolean).join(" · "),
    preset_applied: (n) => `Préréglage « ${n} » appliqué`, volume: "Volume", n_speakers: (n) => `${n} enceinte${n > 1 ? "s" : ""}`, no_speaker: "Aucune enceinte cochée", change: "changer",
    replay_all: "Tout rejouer", play_n: (n) => `Jouer ${n}`, skip: "Passer", clear: "Vider", clear_t: "Vider la file",
    q_options: "Options de la file", plays_on_tap: "joue au toucher", build_then_play: "composer puis Jouer", gap_s: (n) => `${n} s d'écart`,
    play_on_tap: "Jouer au toucher", add_pause: "+ Pause", shorter: "Pause plus courte", longer: "Pause plus longue", gap: "Écart entre les sons",
    q_empty_tap: "Touchez un son pour le jouer tout de suite ; touchez-en d'autres pour les enchaîner.", q_empty_build: "Touchez des sons pour composer une séquence, puis Jouer.",
    waiting: "En attente que toutes les enceintes soient prêtes, pour démarrer ensemble… ", pinned: (n) => ` → réservé à ${n} enceinte(s)`, remove: "retirer", gapw: "écart",
    summoning: "Chargement des sons…", search_n: (n) => `Chercher parmi ${n} sons`, search: "Chercher un son", tap_does: "Effet d'un toucher",
    mode_play: "Jouer", mode_preview: "Écouter ici", mode_play_t: "Un toucher le joue sur les enceintes (ou l'ajoute à la file)", mode_preview_t: "Un toucher le joue seulement ici, pour vous",
    all_c: "Tous", favorites: "Favoris", no_match: "Aucun son ne correspond.", queued: "en file",
    fav_add: "Favori", fav_rm: "Retirer des favoris", down_rm: "Démarquer (le garder)", down_add_pub: "Je n'aime pas (le masque aussi)", down_add: "Marquer pour suppression (le masque aussi)",
    hide: "Masquer", unhide: "Afficher", aim: "Jouer maintenant sur des enceintes choisies", aim_title: (t) => `Jouer « ${t} » maintenant sur…`,
    aim_hint: "Hors file : il part tout de suite sur ces enceintes, mélangé à ce qu'elles jouent déjà.", play_now: "Jouer maintenant", cancel: "Annuler",
    preset_name: "Nom du préréglage (ce qui joue où, volumes, fond sonore) :", preset_del: (n) => `Supprimer le préréglage « ${n} » ?`,
    reset_q: "Oublier tous les favoris, sons masqués, préréglages et réglages enregistrés dans ce navigateur ?", reset_done: "Boîte à sons remise à neuf",
    imported: "Importé", import_failed: (e) => `Échec de l'import : ${e}`, tick_first: "Cochez d'abord au moins une enceinte pour les effets (onglet Enceintes)",
    haunt: "Mode aléatoire", haunt_hint: (a, b) => `Un son au hasard toutes les ${a} à ${b} s, tout seul.`, haunt_opts: "Options du mode aléatoire",
    haunt_every: "Toutes les", haunt_to: "à", haunt_from: "Choisir parmi", favs_only: "♥ Favoris seulement", all_cats: "Toutes les catégories",
    motion: "🏃 Déclenchement au mouvement", motion_hint: "Quand une caméra voit quelqu'un, elle joue un son au hasard (parmi ceux du mode aléatoire) sur son haut-parleur.",
    motion_cool: "Au plus une fois par caméra toutes les", cameras: "Caméras", all_cams: "toutes",
    voices_t: "Voix : quelles langues afficher", voices_in: (l) => `En ${LANG_NAME.fr[l] || l}`,
    scenes: "🎬 Scènes, en un geste", scene_t: (n, d) => `Enchaîne ${n} sons (${d}), avec leurs pauses`,
    tab_settings: "🎚️ Réglages", bg_music: "🎶 Musique", bg_amb: "🌫️ Ambiances",
    bg_music_t: "Les morceaux cochés passent l'un après l'autre", bg_amb_t: "Avec Mélange, toutes les ambiances cochées jouent ensemble, par-dessus la musique",
    sung_in: (l) => `Chanté en ${LANG_NAME.fr[l] || l}`,
    hush: "Silence au moindre bruit",
    hush_hint: (n) => `L'appareil écoute avec son micro : au moindre bruit, tous les sons s'estompent aussitôt et reviennent ${n} s après le dernier bruit. Ses propres sons ne comptent pas. Gardez la page ouverte : l'écran reste allumé pendant l'écoute.`,
    hush_sens: "Sensibilité", hush_hold: "Silence pendant", hush_test: "Tester le micro (30 s)",
    hush_test_t: "Montre pendant 30 s ce qu'entend le micro et où passe la ligne. Tapez dans les mains, parlez, lancez un son : un bruit qui franchit la ligne est marqué.",
    hush_starting: "Ouverture du micro…", hush_denied: "Le micro est bloqué. Autorisez-le pour ce site dans les réglages du navigateur, puis réessayez.",
    hush_nomic: "Pas de micro disponible sur cet appareil.", hush_ended: "Le micro s'est arrêté (une autre appli l'a pris ?). Désactivez puis réactivez.",
    hush_listen: "👂 À l'écoute", hush_heard_ago: (s) => `dernier bruit il y a ${s}`, hush_quiet: (n) => `🤫 Un bruit : les sons reviennent dans ${n} s`,
    hush_testing: (n) => `Test : encore ${n} s. Tapez dans les mains, parlez, lancez un son : ses propres sons restent sous la ligne.`,
    hush_test_off: "Le silence est désactivé : le test montre seulement ce qu'il ferait.",
    hush_l_level: "ce qu'il entend", hush_l_line: "la ligne qu'un bruit doit franchir", hush_l_ours: "ses propres sons, entendus", hush_l_heard: "bruit entendu",
    hush_ios: "Sur iPhone et iPad, Safari peut jouer le son moins fort ou avec des craquements tant que le micro est ouvert (un bug de Safari).",
    hush_l_hushed: "sons estompés", hush_chart_l: "Niveau du micro sur les 30 dernières secondes, en dB au-dessus du calme de la pièce",
  },
};
const LANG_NAME = { en: { en: "English", fr: "French", de: "German" }, fr: { en: "anglais", fr: "français", de: "allemand" } };
const CAT_FR = { ambience: "Ambiances", other: "Autres" };
// config.lang, else the page's choice (public site), else the HA user's language, else the browser's
let LANG = "en";
const setLang = (cfgLang, hass) => {
  const want = cfgLang || LS("lang") || hass?.locale?.language || hass?.language || (navigator.languages || [navigator.language]).join(",");
  LANG = /^fr/i.test(String(want)) ? "fr" : "en";
  return LANG;
};
// the current theme's own words (theme.json "words": {en: {...}, fr: {...}}), over I18N; in a
// theme's words, {0} and {1} stand for the arguments of the I18N function they replace
let THEME_WORDS = {};
// the theme's glyph for effects (💀 at Halloween) and for its random mode (👻)
let FX = "🔊", MODE = "🎲";
const T = (k, ...a) => {
  const v = THEME_WORDS[LANG]?.[k] ?? I18N[LANG][k] ?? THEME_WORDS.en?.[k] ?? I18N.en[k];
  if (typeof v === "function") return v(...a);
  return v == null ? k : String(v).replace(/\{(\d)\}/g, (m, i) => a[i] ?? m);
};
// a sound's title in the UI language; what a voice SAYS stays verbatim (kept as is in title_fr)
const ttl = (s) => (LANG === "fr" && s?.title_fr) || s?.title || "";
const catName = (cats, c) => (LANG === "fr" && (cats[c]?.name_fr || CAT_FR[c])) || cats[c]?.name || c.replace(/-/g, " ");
// languages a spoken sound can be in (library items carry "lang"); the card can show one or both
const VOICE_LANGS = ["en", "fr"];

// ----- looks: the scene behind the card, its palette (STYLE, :host([data-look])) and display font -----
// a bat silhouette: the two wings flap (and glide now and then) around the shoulders, see .bat CSS
const BAT_SVG = `<svg viewBox="0 0 100 44"><path class="wl" d="M47 16C38 8 22 4 4 10c6 3 8 7 7 12 5-3 9-2 11 3 4-4 9-4 12 1 4-4 9-4 13 0z"/>
<path class="wr" d="M53 16c9-8 25-12 43-6-6 3-8 7-7 12-5-3-9-2-11 3-4-4-9-4-12 1-4-4-9-4-13 0z"/>
<path d="M46 9l1.5-6 2 5h1l2-5 1.5 6c1 2 1 4 0 5 2 3 2 9 0 14-1 2-2 3-4 3s-3-1-4-3c-2-5-2-11 0-14-1-1-1-3 0-5z"/></svg>`;
// a reindeer facing right; its legs gallop (.lf front, .lb back), see .sleigh CSS
const REINDEER = (x) => `<g transform="translate(${x} 0)"><path d="M3 23c2-6 9-8 17-6l6-5c1-2 3-3 5-2l2 2-3 2-2 4c-2 4-4 6-9 7-6 1-12 1-16-2z"/>
<path class="ant" d="M27 12l-2-7m2 7l4-5m-6-1l-4-2m4 2l1-4"/>
<path class="lf" d="M19 26l3 8m-2-8l-1 8"/><path class="lb" d="M7 25l-3 8m5-8l1 8"/></g>`;
// Santa's sleigh pulled by four reindeer, facing right: high back, Santa (hat flying back) holding
// the reins, his sack, the front curling up into a scroll, runners on two struts
const SLEIGH_SVG = `<svg viewBox="0 0 250 44"><g class="deer">${REINDEER(122)}${REINDEER(152)}${REINDEER(182)}${REINDEER(212)}</g>
<path class="reins" d="M70 13c18 4 40 6 58 8"/>
<path d="M8 38c-4 0-6-2-6-4h3c0 1 1 2 3 2h80c4 0 6-2 6-5l3 1c0 4-4 6-9 6z"/><path d="M22 30h3v6h-3zM70 30h3v6h-3z"/>
<path d="M12 31C8 23 8 12 12 8c3-2 6 0 6 4l2 6h46c4 0 8-4 12-10 2-4 8-5 10-1 2 4-2 6-4 5-3 4-6 12-10 19z"/>
<path d="M44 18c0-6 3-9 8-9s8 3 8 9z"/><circle cx="52" cy="6.5" r="3.6"/><path d="M48.5 4.5c1-4 6-5 9-2-3-1-8 0-12 3z"/><circle cx="44.5" cy="6" r="1.7"/>
<path d="M58 12l11-1 .5 2.4-11 1.6z"/><path d="M23 18c-1-5 1-8 4-9l1-3 3 2c5 0 9 4 9 10z"/></svg>`;
// Saint Nicholas (mitre, beard, crozier) walking beside his donkey, facing left; the donkey
// carries a basket of clementines
const NICOLAS_SVG = `<svg viewBox="0 0 124 66"><g class="donkey"><path d="M62 31c1-6 9-8 20-8 10 0 16 2 18 8 1 6-1 11-7 13-8 2-21 2-28-1-3-2-4-7-3-12z"/>
<path d="M64 31c-3-4-7-9-11-13-2-2-4-3-6-3l-6 1c-2 0-4 2-4 4l1 3c1 1 3 1 5 0 2 0 4 1 5 3 3 4 6 8 9 11z"/>
<path d="M48 15c-2-5-2-10 0-13 2 3 3 8 2 13zm3 0c1-5 4-9 7-11 0 3-2 8-5 12z"/><path d="M99 28c4 1 6 6 6 11l-1 3-2-1c1-3 0-8-3-10z"/>
<path d="M71 25l1-7h17l1 7z"/><circle class="fruit" cx="76" cy="17" r="2.6"/><circle class="fruit" cx="82" cy="16.4" r="2.6"/>
<path class="lf" d="M67 41l-2 19h3.4l2-18zm6 1l1 18h3.4l-1-18z"/><path class="lb" d="M88 41l2 19h3.4l-1-19zm6-1l3 18h3.4l-3-18z"/></g>
<g class="saint"><path d="M22 24c-6 6-9 22-10 40h22c-1-18-3-34-9-40z"/><circle cx="23" cy="19" r="4.6"/>
<path d="M18 15c0-6 2-10 5-12 3 2 5 6 5 12z"/><path d="M19 22c2 5 6 5 8 0l-1 10c-2 2-5 2-7 0z"/>
<path class="crozier" d="M8 64V13c0-6 8-7 8-1 0 3-4 3-4 1"/></g></svg>`;
const LOOKS = {
  // Halloween: fog, a lightning flash now and then, bats crossing the moon
  night: {
    font: ["SB Night", "pirata-one.woff2"],
    scene: () => `<div class="fog"></div><div class="flash-sky"></div>
      <div class="bats"><i class="moon"></i>${[1, 2, 3, 4].map((n) => `<span class="bat b${n}"><span class="bob">${BAT_SVG}</span></span>`).join("")}</div>`,
  },
  // Christmas: snowfall, twinkling stars, a string of lights, the sleigh crossing the moon, and
  // Saint Nicholas walking by with his donkey now and then
  winter: {
    font: ["SB Winter", "berkshire-swash.woff2"],
    scene: () => `<div class="snow"><i class="s1"></i><i class="s2"></i><i class="s3"></i></div>
      <div class="sky"><i class="moon"></i>${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<i class="star t${n}"></i>`).join("")}
        <span class="sleigh"><span class="bob">${SLEIGH_SVG}</span></span>
        <span class="nicolas"><span class="step">${NICOLAS_SVG}</span></span></div>
      <div class="lights">${Array.from({ length: 14 }, () => `<svg viewBox="0 0 120 34"><path d="M0 4Q60 28 120 4"/>
        <ellipse cx="22" cy="17" rx="4.4" ry="6.6"/><ellipse cx="60" cy="23" rx="4.4" ry="6.6"/><ellipse cx="98" cy="17" rx="4.4" ry="6.6"/></svg>`).join("")}</div>`,
  },
};
const lookOf = (name) => (LOOKS[name] ? name : "night");
const useLookFont = (name) => {
  const [family, file] = LOOKS[name].font;
  fontFace(`soundboard-font-${name}`, `@font-face{font-family:"${family}";src:url(${FONT_BASE}${file}) format("woff2");font-display:swap}`);
};

// ---------------------------------------------------------------------------------------
// Hush: every sound fades out when this device's microphone hears a noise, and comes back a few
// seconds after the last one (themes with "hush", public build: there the page itself plays every
// sound, so it knows what it plays and can tell its own sounds from a noise in the room).
// The microphone is opened raw: the browser's echo cancellation would put a phone in "call" mode
// (quieter, duller playback, a Bluetooth speaker switched to its call profile). Except on iOS,
// where Safari (26.2-27, WebKit bug 326286) moves playback to the earpiece when it is off, and
// crackles but stays on the loudspeaker when it is on: there it stays on. Instead, every
// 20 ms, the worklet measures three bands of what the microphone hears and of what the page sends
// to the speakers; HushDetector learns how loud its own sound comes back and reacts only to what
// that can't explain. Nothing of it exists while it is off.
// ---------------------------------------------------------------------------------------
const HUSH_WORKLET = `class SBHush extends AudioWorkletProcessor {
  constructor() { super(); this.acc = new Float64Array(6); this.n = 0; this.len = Math.round(sampleRate * 0.02); }
  process(inputs) {
    const inp = inputs[0] || [];
    for (let c = 0; c < 6; c++) {
      const ch = inp[c];
      if (!ch) continue;
      let s = 0;
      for (let i = 0; i < ch.length; i++) s += ch[i] * ch[i];
      this.acc[c] += s;
    }
    this.n += 128;
    if (this.n >= this.len) {
      const f = new Float64Array(7);
      for (let c = 0; c < 6; c++) f[c] = this.acc[c] / this.n;
      f[6] = this.n;
      this.port.postMessage(f);
      this.acc.fill(0);
      this.n = 0;
    }
    return true;
  }
}
registerProcessor("sb-hush", SBHush);`;
// band centres (Hz): thumps and footsteps, voices, rustling paper and little bells
const HUSH_BANDS = [250, 1000, 3500];
const HUSH = {
  CAL: 0.8, // s: the first frames give the room's quiet
  WIN: 0.8, // s: our own sound may come back this late (a Bluetooth speaker: 0.2-0.5 s) ...
  DECAY: 60, // dB/s: ... then dies away like a room's reverberation
  C0: 20, // dB: how loud our own sound comes back, until measured (more than any real setup:
  //          a phone's mic next to its own speaker can hear it louder than it was sent)
  CWIN: 15, // s of playing kept to measure it: the loudest it came back in that time
  CMIN: 1.5, // s of it needed before the measure replaces the assumption
  PLAYING: -70, // dB: a band counts as playing above this output level
  // the room's quiet: follows a quieter room at once, a steadily louder one (a fan, a heater
  // starting) by 2 dB/s, noise or not: else a fan would keep everything hushed for good
  FALL: 0.15, RISE: 2,
  RESUME: 4, BACKOFF: 4, BACKOFF_MAX: 18, BACKOFF_DECAY: 1 / 30, // s, dB, dB, dB/s (see push)
};
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
// sensitivity 1..10 -> how far above the room's quiet a noise must be (dB): 26 .. 8
const hushMargin = (sens) => 8 + (10 - sens) * 2;
const dB = (x) => Math.max(-110, 10 * Math.log10(x + 1e-12));
const pctl = (arr, q) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))]; };

class HushDetector {
  constructor() {
    this.t = 0;
    this.dt = 0.02;
    this.cal = [];
    this.floor = null; // the room's quiet, per band (dB): a low percentile that follows the room
    this.recent = []; // our output levels over the last WIN s: [band 0, 1, 2, all]
    this.env = [-110, -110, -110, -110];
    // how loud our own sound comes back, per microphone band: from the same band's output (c) and
    // from the whole output (cx: a small speaker's distortion lands in other bands)
    this.need = [[], [], []];
    this.needX = [[], [], []];
    this.c = [HUSH.C0, HUSH.C0, HUSH.C0];
    this.cx = [HUSH.C0, HUSH.C0, HUSH.C0];
    this.backoff = [0, 0, 0];
    this.prev = [false, false];
    this.resumeAt = -1e9;
    this.nextFit = 0;
  }

  // the sounds just came back (after a hush): a noise in the next seconds may be their own echo
  resumed() { this.resumeAt = this.t; this.guarded = false; }

  // p: mean power of the three microphone bands, then of the three output bands; dt: frame (s).
  // Returns null while calibrating, else {trig, level, line, ours} (dB above the room's quiet, in
  // the band closest to a trigger)
  push(p, dt, sens) {
    this.t += dt;
    this.dt = dt;
    const m = [dB(p[0]), dB(p[1]), dB(p[2])];
    const o = [dB(p[3]), dB(p[4]), dB(p[5]), dB(p[3] + p[4] + p[5])];
    this.recent.push(o);
    while (this.recent.length > Math.max(1, Math.round(HUSH.WIN / dt))) this.recent.shift();
    for (let k = 0; k < 4; k++) {
      let mx = -110;
      for (const r of this.recent) if (r[k] > mx) mx = r[k];
      this.env[k] = Math.max(mx, this.env[k] - HUSH.DECAY * dt);
    }
    // the room's quiet, from the first frames in which we play nothing (or, if we play all along,
    // the quietest: it falls to the real quiet as soon as our sound pauses)
    if (this.t < HUSH.CAL) { this.cal.push([m, this.env[3] < HUSH.PLAYING]); return null; }
    if (!this.floor) {
      const quiet = this.cal.filter((x) => x[1]);
      this.floor = [0, 1, 2].map((b) => (quiet.length >= 10 ? pctl(quiet.map((x) => x[0][b]), 0.3) : Math.min(...this.cal.map((x) => x[0][b]))));
    }
    if (this.t >= this.nextFit) { this.fit(); this.nextFit = this.t + 0.5; }
    const S = hushMargin(sens), Se = Math.max(6, S - 4);
    const res = [];
    let best = -1e9, bi = 0;
    for (let b = 0; b < 3; b++) {
      this.backoff[b] = Math.max(0, this.backoff[b] - HUSH.BACKOFF_DECAY * dt);
      const F = this.floor[b];
      const ours = Math.max(this.env[b] + this.c[b], this.env[3] + this.cx[b]) + this.backoff[b];
      const line = Math.max(F + S, ours + Se);
      res.push({ F, ours, line });
      if (m[b] - line > best) { best = m[b] - line; bi = b; }
    }
    let cand = best > 0;
    // just after the sounds came back (fading in), a borderline "noise" in a band they play in is
    // most likely their own echo, louder than measured: not a noise, and from now on expect our
    // sound a bit louder there (a loud noise is a real one)
    if (cand && best < 10 && this.t - this.resumeAt < HUSH.RESUME && res[bi].ours > res[bi].F - 3) {
      cand = false;
      if (!this.guarded) { this.guarded = true; this.backoff[bi] = Math.min(HUSH.BACKOFF_MAX, this.backoff[bi] + HUSH.BACKOFF); }
    }
    // a noise: two frames out of three over the line (40 ms), or one far over it (a knock)
    const trig = cand && (best > 8 || this.prev[0] || this.prev[1]);
    this.prev = [cand, this.prev[0]];
    for (let b = 0; b < 3; b++) {
      const F = this.floor[b];
      // while we play: what the microphone hears above the quiet, against what we sent; a frame
      // the room's quiet explains needs nothing (-Infinity)
      if (!cand) {
        const heard = m[b] > F + 4;
        if (this.env[b] > HUSH.PLAYING) this.need[b].push([this.t, heard ? m[b] - this.env[b] : -Infinity]);
        if (this.env[3] > HUSH.PLAYING) this.needX[b].push([this.t, heard ? m[b] - this.env[3] : -Infinity]);
      }
      if (m[b] < F) this.floor[b] = Math.max(-110, F + (m[b] - F) * HUSH.FALL);
      else if (res[b].ours < F - 3) this.floor[b] = F + Math.min(m[b] - F, HUSH.RISE * dt);
    }
    const r = res[bi];
    return { trig, level: m[bi] - r.F, line: r.line - r.F, ours: r.ours - r.F };
  }

  fit() {
    const since = this.t - HUSH.CWIN;
    for (let b = 0; b < 3; b++) {
      for (const [list, out] of [[this.need, this.c], [this.needX, this.cx]]) {
        const a = list[b];
        let i = 0;
        while (i < a.length && a[i][0] < since) i++;
        if (i) a.splice(0, i);
        // too little playing lately (e.g. faded out for a while): keep the last measure
        if (a.length * this.dt < HUSH.CMIN) continue;
        let v = -Infinity;
        for (const x of a) if (x[1] > v) v = x[1];
        out[b] = v === -Infinity ? -60 : Math.min(30, v);
      }
    }
  }
}

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
    this.rpool = []; // the same, played through Web Audio (while hush listens): {audio, gain}
    this.routeMusic = false;
    this.out = null; // every sound this page plays goes through this gain (the hush fades it)
    this.hush = null; // listening: {det, stream, nodes, frames, status, hushed, until, heard}
    this.hushTestUntil = 0;
    this.locked = true;
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && this.hush) this.wakeLock(true); });
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
    const lib = await this.hass.callWS({ type: "soundboard/library", theme });
    if (this.libTheme !== theme) return; // switched again meanwhile
    this.lib = lib;
    THEME_WORDS = lib?.words || {};
    FX = lib?.fx_emoji || "🔊";
    MODE = lib?.mode_emoji || "🎲";
    this.render(true);
  }

  // spoken sounds carry "lang": the languages this library has, and the ones shown (settings
  // voice_langs; none set = all of them)
  voiceLangs() {
    if (this._vlLib !== this.lib) {
      this._vlLib = this.lib;
      // effects only: a sung carol's language is shown on it, not filtered
      const all = this.lib?.sfx || [];
      this._vl = VOICE_LANGS.filter((l) => all.some((s) => s.lang === l));
    }
    return this._vl;
  }

  shownLangs() {
    const have = this.voiceLangs();
    const want = (this.state?.settings?.voice_langs || []).filter((l) => have.includes(l));
    return want.length ? want : have;
  }

  langOk(s, shown = this.shownLangs()) { return !s.lang || shown.includes(s.lang); }

  render(full = false) {
    this.syncHush();
    for (const c of this.cards) c.update(full);
  }

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
  audioCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (!this.out) {
      this.out = this.ctx.createGain();
      this.out.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  unlock() {
    this.audioCtx();
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
      return await this.audioCtx().decodeAudioData(data);
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
    src.connect(gain).connect(this.out);
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
      // a looping layer loops by itself here: a repeat of the same track must not restart it
      if (m.loop && l.url === m.url && !l.audio.paused) { this.setVol(l, m.volume); return; }
      const src = await this.sign(m.url, true);
      if (gen !== l.gen || this.layers.get(id) !== l) return;
      const a = l.audio;
      l.url = m.url;
      a.loop = !!m.loop;
      // fresh link per track: a 7 h track streams with range requests for hours, so a
      // cached link close to its 24 h expiry would start being refused mid-track
      a.src = src;
      this.setVol(l, m.volume);
      const start = () => { try { a.currentTime = m.offset; } catch (e) { /* not seekable yet */ } a.play().catch(() => { this.locked = true; this.render(); }); };
      if (a.readyState >= 1) start(); else a.addEventListener("loadedmetadata", start, { once: true });
    } else if (m.cmd === "music_stop") {
      for (const id of m.layer ? [m.layer] : [...this.layers.keys()]) this.dropLayer(id);
    } else if (m.cmd === "music_volume") {
      for (const [id, v] of Object.entries(m.layers || {})) { const l = this.layers.get(id); if (l) this.setVol(l, v); }
    }
  }

  layer(id) {
    let l = this.layers.get(id);
    if (!l) {
      const busy = new Set([...this.layers.values()].map((x) => x.audio));
      const r = this.routeMusic && this.ctx ? this.routed(busy)
        : { audio: this.pool.find((a) => !busy.has(a)) || new Audio(), gain: null };
      l = { audio: r.audio, gain: r.gain, gen: 0 };
      this.layers.set(id, l);
    }
    return l;
  }

  // an <audio> played through Web Audio (its own gain, then this.out), so the hush hears it and
  // fades it. Only while listening: phones stop Web Audio when the screen locks, not <audio>.
  routed(busy) {
    let r = this.rpool.find((x) => !busy.has(x.audio));
    if (!r) {
      const audio = new Audio();
      const gain = this.ctx.createGain();
      this.ctx.createMediaElementSource(audio).connect(gain).connect(this.out);
      r = { audio, gain };
      this.rpool.push(r);
    }
    return r;
  }

  setVol(l, v) {
    if (l.gain) { l.gain.gain.value = clamp01(v); l.audio.volume = 1; } else l.audio.volume = clamp01(v);
  }

  // listening starts while tracks play: each moves onto a routed <audio>, where it was
  routeLayers() {
    if (!this.ctx) return;
    const busy = new Set([...this.layers.values()].map((x) => x.audio));
    for (const l of this.layers.values()) {
      if (l.gain) continue;
      const old = l.audio, r = this.routed(busy);
      busy.add(r.audio);
      r.gain.gain.value = old.volume;
      r.audio.loop = old.loop;
      if (old.src && !old.paused) {
        const at = old.currentTime;
        r.audio.src = old.src;
        const go = () => { try { r.audio.currentTime = at + 0.1; } catch (e) { /* not seekable yet */ } r.audio.play().catch(() => {}); };
        if (r.audio.readyState >= 1) go(); else r.audio.addEventListener("loadedmetadata", go, { once: true });
      }
      old.pause();
      l.audio = r.audio;
      l.gain = r.gain;
    }
  }

  // ----- hush (see HushDetector) -----
  hushWanted() {
    if (!this.lib?.hush) return false;
    return !!this.state?.settings?.hush?.on || this.hushTestUntil > Date.now();
  }

  // from the tap that turns it on or starts a test: a phone lets an <audio> start only from a tap
  hushArm() {
    this.unlock();
    while (this.rpool.length < 4) {
      const r = this.routed(new Set(this.rpool.map((x) => x.audio)));
      r.audio.src = SILENT_WAV;
      r.audio.play().then(() => { if (r.audio.src === SILENT_WAV) r.audio.pause(); }).catch(() => {});
    }
    this.routeMusic = true;
    this.routeLayers();
  }

  syncHush() {
    const want = this.hushWanted();
    if (want && !this.hush) this.hushStart();
    else if (!want && this.hush) this.hushStop();
  }

  async hushStart() {
    const h = (this.hush = { det: new HushDetector(), frames: [], status: "starting", hushed: false, until: 0, heard: 0, nodes: [], taps: [] });
    try {
      this.audioCtx();
      this.routeMusic = true;
      this.routeLayers();
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("no microphone API"), { name: "NotFoundError" });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: IOS, noiseSuppression: false, autoGainControl: false } });
      h.stream = stream;
      if (this.hush !== h) { stream.getTracks().forEach((t) => t.stop()); return; }
      const ctx = this.ctx;
      this.hushModule ||= ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([HUSH_WORKLET], { type: "text/javascript" })));
      await this.hushModule;
      if (this.hush !== h) { stream.getTracks().forEach((t) => t.stop()); return; }
      const mic = ctx.createMediaStreamSource(stream);
      const merger = ctx.createChannelMerger(6);
      h.nodes.push(mic, merger);
      HUSH_BANDS.forEach((f, i) => {
        for (const [src, ch] of [[mic, i], [this.out, 3 + i]]) {
          const bp = ctx.createBiquadFilter();
          bp.type = "bandpass";
          bp.frequency.value = f;
          bp.Q.value = 0.7;
          src.connect(bp);
          bp.connect(merger, 0, ch);
          h.taps.push([src, bp]);
          h.nodes.push(bp);
        }
      });
      const node = new AudioWorkletNode(ctx, "sb-hush", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
        channelCount: 6, channelCountMode: "explicit", channelInterpretation: "discrete" });
      const sink = ctx.createGain(); // keeps the worklet pulled by the graph, silently
      sink.gain.value = 0;
      merger.connect(node).connect(sink).connect(ctx.destination);
      h.nodes.push(node, sink);
      h.node = node;
      node.port.onmessage = (e) => this.hushFrame(h, e.data);
      stream.getAudioTracks()[0]?.addEventListener("ended", () => { if (this.hush === h) { h.status = "ended"; this.render(); } });
      h.status = "listening";
      this.wakeLock(true);
    } catch (e) {
      console.warn("soundboard hush", e);
      h.status = e?.name === "NotAllowedError" || e?.name === "SecurityError" ? "denied" : "nomic";
    }
    this.render();
  }

  hushFrame(h, f) {
    if (this.hush !== h) return;
    const s = this.state?.settings?.hush || {};
    const r = h.det.push(f, f[6] / this.ctx.sampleRate, s.sens ?? 8);
    const t = h.det.t;
    let changed = false;
    if (r?.trig) {
      h.heard = Date.now();
      if (s.on) {
        h.until = t + (s.hold_s ?? 10);
        if (!h.hushed) { h.hushed = true; this.duck(0, 0.08); changed = true; }
      }
    }
    if (h.hushed && (t >= h.until || !s.on)) {
      h.hushed = false;
      this.duck(1, 0.8);
      h.det.resumed();
      changed = true;
    }
    if (r) {
      h.frames.push([t, r.level, r.line, r.ours, r.trig ? 1 : 0, h.hushed ? 1 : 0]);
      if (h.frames.length > 1800) h.frames.splice(0, 300);
    }
    if (changed) this.render();
  }

  // fade everything this page plays: down fast (tau 0.08 s: silent in ~0.3 s), back up gently
  duck(v, tau) {
    if (!this.out) return;
    const g = this.out.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setTargetAtTime(v, t, tau);
  }

  hushStop() {
    const h = this.hush;
    this.hush = null;
    if (!h) return;
    h.stream?.getTracks().forEach((t) => t.stop());
    if (h.node) h.node.port.onmessage = null;
    for (const [src, n] of h.taps) { try { src.disconnect(n); } catch (e) { /* gone */ } }
    for (const n of h.nodes) { try { n.disconnect(); } catch (e) { /* gone */ } }
    if (h.hushed) this.duck(1, 0.3);
    this.routeMusic = false;
    this.wakeLock(false);
    this.render();
  }

  hushTest() {
    this.hushArm();
    this.hushTestUntil = Date.now() + 30000;
    clearTimeout(this._htT);
    this._htT = setTimeout(() => this.render(), 30100);
    this.render();
  }

  // the screen stays on while listening (a sleeping phone hears nothing)
  async wakeLock(on) {
    if (!on) { const w = this._wl; this._wl = null; w?.release?.().catch(() => {}); return; }
    try {
      if ("wakeLock" in navigator && !this._wl) {
        this._wl = await navigator.wakeLock.request("screen");
        this._wl.addEventListener("release", () => { this._wl = null; });
      }
    } catch (e) { /* not allowed here (e.g. page hidden) */ }
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
        <div class="backdrop" aria-hidden="true"></div>
        <header class="top"></header>
        <nav class="bar"></nav>
        <div class="lock" hidden></div>
        <section class="sec dev" data-tab="spk"><div class="sec-b dev-b"></div></section>
        <section class="sec fx" data-sec="fx" data-tab="snd">
          <h2 class="sec-h"><span class="fx-h"></span><span class="sec-sub fx-sub"></span><ha-icon class="chev" icon="mdi:chevron-down"></ha-icon></h2>
          <div class="sec-b">
            <div class="via" data-panel="sfx"></div>
            <div class="row ctl fx-ctl"></div>
            <div class="scenes"></div>
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
    // the library's look wins (it is the theme being shown); the theme list's until it loads
    const look = lookOf(SB.lib?.look || theme.look);
    if (this._look !== look) {
      this._look = look;
      useLookFont(look);
      this.dataset.look = look;
      this.$(".backdrop").innerHTML = LOOKS[look].scene();
      this.dispatchEvent(new CustomEvent("soundboard-look", { detail: { look }, bubbles: true, composed: true }));
    }
    const lock = this.$(".lock");
    lock.hidden = !(SB.locked && this.thisDeviceSelected());
    this.setHTML(".lock", this.config.standalone ? T("lock_public") : T("lock_house"));
    this.setHTML(".fx-h", `${FX} ${T("sfx")}`);
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
    this.renderScenes();
    this.renderHaunt();
    this.renderQueue();
    this.renderHistory();
    this.renderAim();
    if (SB.hush && this.ui.tab === "spk") this.hushLoop();
    const q = st.queue;
    const cur = q.items.find((i) => i.uid === q.current && !i.waiting);
    const queued = q.items.filter((i) => i.status === "pending" && i.type === "sound").map((i) => i.id);
    const bankKey = JSON.stringify([LANG, SB.libTheme, SB.lib?.sfx?.length, this.ui, st.hidden?.[SB.libTheme], st.marks?.[SB.libTheme], st.settings.voice_langs, cur?.id, queued]);
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
    const shown = SB.shownLangs();
    const n = SB.lib ? SB.lib.sfx.filter((s) => !SB.isHidden(s.id) && SB.langOk(s, shown)).length : 0;
    const name = (t) => (LANG === "fr" && t.name_fr) || t.name;
    this.setHTML(".top", `
      <div class="brand"><span class="emoji">${esc(theme.emoji || "🎵")}</span>
        <div><div class="title">${esc(name(theme) || T("soundboard"))}</div>
        <div class="subtitle">${T("soundboard")}${n ? ` · ${T("sounds_n", n)}` : ""}</div></div></div>
      ${themes.length > 1 ? `<div class="themes">${themes.map((t) => `<button class="chip theme ${t.id === st.settings.theme ? "on" : ""}" data-act="theme" data-id="${esc(t.id)}">${esc(t.emoji || "")} ${esc(name(t))}</button>`).join("")}</div>` : ""}
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
      ? tab("spk", T("tab_settings"), `🎼 ${pct(s.music.volume)} · ${FX} ${pct(s.sfx.volume)}${s.hush?.on ? " · 🤫" : ""}`)
      : tab("spk", T("tab_speakers"), `🎼 ${s.music.speakers.length} · ${FX} ${s.sfx.speakers.length}`);
    const haunt = s.haunt?.on;
    const live = [m.playing ? `🎼 ${T("on")}` : "", q.running ? `${FX} ${T("on")}` : "", haunt ? MODE : "", s.motion?.on && !this.config.guest ? "🏃" : "",
      SB.hush?.hushed ? "🤫" : ""].filter(Boolean).join(" · ");
    this.setHTML(".bar", spk + tab("snd", `${esc(theme.emoji || "🎵")} ${T("tab_sounds")}`, live || T("pick_play"))
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
    const row = (t) => {
      const lvl = Math.round((levels[t.id] ?? 1) * 100);
      // the slider sits outside the <label> so dragging it doesn't tick the box
      return `<div class="track-w ${sel.has(t.id) ? "sel" : ""}"><label class="track ${layers.some((l) => l.track === t.id) ? "playing" : ""} ${this.markClass(t.id)}">
        <input type="checkbox" data-act="track" data-id="${esc(t.id)}" ${sel.has(t.id) ? "checked" : ""}>
        <span class="t-title">${esc(ttl(t))}${t.lang ? ` <span class="m-lang" title="${T("sung_in", t.lang)}">${esc(t.lang.toUpperCase())}</span>` : ""}</span>${this.icons(t.id, fmtDur(t.duration), false)}
      </label>${ms.mix && sel.has(t.id) ? `<div class="lvl"><ha-icon icon="mdi:volume-high"></ha-icon>
        <input type="range" min="0" max="150" step="5" value="${lvl}" data-act="level" data-id="${esc(t.id)}" list="lvl-100"
          title="${T("level_t")}"><span class="lvl-v">${lvl}%</span></div>` : ""}</div>`;
    };
    // music (carols: usually one at a time) apart from ambiences (fire, wind: often several)
    const music = tracks.filter((t) => t.group === "music"), amb = tracks.filter((t) => t.group !== "music");
    const list = (ts) => `<div class="tracks-in">${ts.map(row).join("")}</div>`;
    this.setHTML(".tracks", !tracks.length ? `<div class="empty">${T("no_tracks")}</div>`
      : (music.length && amb.length
        ? `<div class="tgroup"><div class="lbl" title="${T("bg_music_t")}">${T("bg_music")}</div>${list(music)}</div>
           <div class="tgroup"><div class="lbl" title="${T("bg_amb_t")}">${T("bg_amb")}</div>${list(amb)}</div>`
        : list(tracks)) + `<datalist id="lvl-100"><option value="100"></option></datalist>`);
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
      <button class="btn" data-act="mnext" ${m.playing && layers.find((l) => l.id === (m.mix ? "music" : "main"))?.count > 1 ? "" : "disabled"} aria-label="${T("next_track")}"><ha-icon icon="mdi:skip-next"></ha-icon></button>
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

  // Speakers tab: presets, the two masters, motion scares, one row per speaker (🎼 / effects + its level)
  renderDevices() {
    const st = SB.state, s = st.settings, cfg = this.config;
    const P = [["music", "🎼", T("background")], ["sfx", FX, T("effects")]];
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
      const offlineDone = LS(`offline_done.${SB.libTheme}`);
      this.setHTML(".dev-b", presetsHtml + masters + this.hushHtml() + `
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
      const dot = (o.kind === "camera" || o.kind === "bluetooth") && o.ready !== "cold" ? `<i class="dot ${o.ready}"></i>` : "";
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
      <div class="dev-t"><div class="dev-row dev-cols"><span class="dev-n">${T("speakers")}
          <button class="chip warm sm ${st.warm ? "on" : ""}" data-act="warm" title="${T("instant_t")}"><ha-icon icon="mdi:flash"></ha-icon>${T("instant_short")}: ${warmTxt}</button></span>${P.map(([, emoji, label]) => `<span class="tg-h" title="${label}"><span>${emoji}</span><small>${label}</small></span>`).join("")}<span class="tg-h" title="${T("level_t2")}"><span>🎚️</span><small>${T("level")}</small></span></div>
        ${groups}</div>`);
  }

  // public build, themes with "hush": fade out at a noise the microphone hears (see HushDetector)
  hushHtml() {
    if (!SB.lib?.hush) return "";
    const h = { on: false, sens: 8, hold_s: 10, ...(SB.state.settings.hush || {}) };
    const testing = SB.hushTestUntil > Date.now();
    return `<div class="hush-p ${h.on ? "on" : ""}">
      <label class="tog big"><input type="checkbox" data-act="hush" ${h.on ? "checked" : ""}> 🤫 ${T("hush")}</label>
      <span class="hint">${T("hush_hint", h.hold_s)}${IOS ? ` ${T("hush_ios")}` : ""}</span>
      <div class="ctl-line gap"><span>${T("hush_sens")}</span>
        <input type="range" min="1" max="10" step="1" value="${h.sens}" data-act="hsens" aria-label="${T("hush_sens")}"><b class="gap-v">${h.sens}/10</b></div>
      <div class="ctl-line gap"><span>${T("hush_hold")}</span>
        <input type="range" min="3" max="60" step="1" value="${h.hold_s}" data-act="hhold" aria-label="${T("hush_hold")}"><b class="gap-v">${h.hold_s}s</b></div>
      <div class="ctl-line"><button class="btn sm" data-act="htest" ${testing ? "disabled" : ""} title="${T("hush_test_t")}">🎙️ ${T("hush_test")}</button></div>
      <div class="hush-status hint" aria-live="polite"></div>
      ${SB.hush ? `<div class="hush-w"><canvas class="hush-chart" role="img" aria-label="${T("hush_chart_l")}"></canvas>
        <div class="hush-leg"><span><i class="sw lv"></i>${T("hush_l_level")}</span><span><i class="sw th"></i>${T("hush_l_line")}</span>
          <span><i class="sw ow"></i>${T("hush_l_ours")}</span><span><i class="sw tr"></i>${T("hush_l_heard")}</span>${h.on ? `<span><i class="sw hd"></i>${T("hush_l_hushed")}</span>` : ""}</div></div>` : ""}
    </div>`;
  }

  hushStatus() {
    const h = SB.hush;
    if (!h) return "";
    if (h.status !== "listening") return T(`hush_${h.status}`);
    const on = !!SB.state?.settings?.hush?.on;
    const left = Math.ceil((SB.hushTestUntil - Date.now()) / 1000);
    if (left > 0) return T("hush_testing", left) + (on ? "" : ` ${T("hush_test_off")}`);
    if (h.hushed) return T("hush_quiet", Math.max(1, Math.ceil(h.until - h.det.t)));
    const ago = h.heard ? Math.round((Date.now() - h.heard) / 1000) : null;
    return T("hush_listen") + (ago != null ? ` · ${T("hush_heard_ago", ago < 60 ? `${ago} s` : fmtDur(ago))}` : "");
  }

  // the live chart and status line, while listening and the settings tab shows them
  hushLoop() {
    if (this._hraf) return;
    let last = 0;
    const tick = (now) => {
      this._hraf = null;
      const cv = this.shadowRoot?.querySelector(".hush-chart");
      const st = this.shadowRoot?.querySelector(".hush-status");
      if (!SB.hush || this.ui.tab !== "spk") { if (st) st.textContent = this.hushStatus(); return; }
      if (now - last > 50) {
        last = now;
        if (st) st.textContent = this.hushStatus();
        if (cv) this.drawHush(cv);
      }
      this._hraf = requestAnimationFrame(tick);
    };
    this._hraf = requestAnimationFrame(tick);
  }

  // last 30 s: what the microphone hears (dB above the room's quiet), the line a noise must cross
  // (it rises with what this device plays), our own sound as heard, noises heard, faded spans
  drawHush(cv) {
    const h = SB.hush, fr = h.frames;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const css = getComputedStyle(this);
    const col = (v, d) => css.getPropertyValue(v).trim() || d;
    const fg = col("--fg", "#eee"), accent = col("--sb-accent", "#e23744"), live = col("--live", "#ffd76e"), mute = col("--mute", "#999");
    const SPAN = 30, Y0 = -6, Y1 = 42, padL = 30, top = 6, bottom = H - 6;
    const tEnd = h.det.t;
    const x = (t) => padL + (W - padL) * (1 - (tEnd - t) / SPAN);
    const y = (v) => bottom - ((Math.max(Y0, Math.min(Y1, v)) - Y0) / (Y1 - Y0)) * (bottom - top);
    g.font = "10px system-ui, sans-serif";
    g.textBaseline = "middle";
    for (const v of [0, 20, 40]) {
      g.strokeStyle = "rgba(255,255,255,.08)";
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(padL, y(v)); g.lineTo(W, y(v)); g.stroke();
      g.fillStyle = mute;
      g.fillText(v ? `+${v}` : "0", 4, y(v));
    }
    const vis = fr.filter((f) => f[0] >= tEnd - SPAN);
    if (!vis.length) return;
    // faded-out spans (hatched, as in the legend)
    if (!this._hatch) {
      const t = document.createElement("canvas");
      t.width = t.height = 8;
      const tg = t.getContext("2d");
      tg.strokeStyle = "rgba(255,255,255,.13)";
      tg.lineWidth = 2;
      tg.beginPath(); tg.moveTo(0, 8); tg.lineTo(8, 0); tg.stroke();
      this._hatch = t;
    }
    g.fillStyle = g.createPattern(this._hatch, "repeat");
    for (let i = 0; i < vis.length; i++) {
      if (!vis[i][5]) continue;
      let j = i;
      while (j + 1 < vis.length && vis[j + 1][5]) j++;
      g.fillRect(x(vis[i][0]), top, Math.max(1, x(vis[j][0]) - x(vis[i][0])), bottom - top);
      i = j;
    }
    // our own sound, as the microphone should hear it
    g.fillStyle = "rgba(180,190,205,.22)";
    g.beginPath();
    g.moveTo(x(vis[0][0]), bottom);
    for (const f of vis) g.lineTo(x(f[0]), y(f[3]));
    g.lineTo(x(vis[vis.length - 1][0]), bottom);
    g.closePath();
    g.fill();
    const path = (k, color, dash) => {
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.lineJoin = "round";
      g.setLineDash(dash);
      g.beginPath();
      vis.forEach((f, i) => (i ? g.lineTo(x(f[0]), y(f[k])) : g.moveTo(x(f[0]), y(f[k]))));
      g.stroke();
      g.setLineDash([]);
    };
    path(2, accent, [5, 4]);
    path(1, fg, []);
    // noises heard
    g.strokeStyle = live;
    g.lineWidth = 2;
    for (const f of vis) if (f[4]) { g.beginPath(); g.moveTo(x(f[0]), top); g.lineTo(x(f[0]), bottom); g.stroke(); }
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

  // Scenes (library "scenes"): a whole sequence queued with one tap, e.g. Saint Nicholas arriving:
  // little bells, the donkey up the path, three knocks, his greeting. An item is a sound id, a
  // pause ({pause: s}) or a spoken line ({voice: {en: id, fr: id}}, said in a language shown)
  sceneItems(sc) {
    const have = new Set((SB.lib?.sfx || []).map((x) => x.id));
    const shown = SB.shownLangs();
    const lang = shown.includes(LANG) ? LANG : shown[0];
    return (sc.items || []).map((it) => {
      if (typeof it === "string") return have.has(it) ? { type: "sound", id: it, theme: SB.libTheme } : null;
      if (it.pause) return { type: "pause", duration: Math.min(120, Math.max(0.5, +it.pause)) };
      const id = it.voice && (it.voice[lang] || Object.values(it.voice)[0]);
      return id && have.has(id) ? { type: "sound", id, theme: SB.libTheme } : null;
    }).filter(Boolean);
  }

  renderScenes() {
    const scenes = (SB.lib?.scenes || []).map((sc) => [sc, this.sceneItems(sc)]).filter(([, items]) => items.some((i) => i.type === "sound"));
    if (!scenes.length) { this.setHTML(".scenes", ""); return; }
    const dur = (items) => items.reduce((t, i) => t + (i.type === "pause" ? i.duration : SB.lib.sfx.find((x) => x.id === i.id)?.duration || 0), 0);
    this.setHTML(".scenes", `<div class="scenes-in"><span class="lbl">${T("scenes")}</span><div class="chips">${scenes.map(([sc, items]) =>
      `<button class="chip scene" data-act="scene" data-id="${esc(sc.id)}" title="${esc(T("scene_t", items.filter((i) => i.type === "sound").length, fmtDur(dur(items))))}">
        <span class="sc-e">${esc(sc.emoji || "🎬")}</span>${esc((LANG === "fr" && sc.name_fr) || sc.name)}<small>${fmtDur(dur(items))}</small></button>`).join("")}</div></div>`);
  }

  // Effects section: haunt mode (a random scare every few seconds, by itself)
  renderHaunt() {
    const h = SB.state.settings.haunt;
    if (!h || !SB.lib) { this.setHTML(".haunt", ""); return; }
    const cats = SB.lib.categories || {};
    const catIds = [...new Set(SB.lib.sfx.map((s) => s.category))].sort((a, b) => (cats[a]?.order ?? 99) - (cats[b]?.order ?? 99) || a.localeCompare(b));
    const picked = new Set(h.cats || []);
    this.setHTML(".haunt", `<div class="haunt-in ${h.on ? "on" : ""}">
      <label class="tog big"><input type="checkbox" data-act="haunt" ${h.on ? "checked" : ""}> ${MODE} ${T("haunt")}</label>
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

  // "devices": portable ones, no header (Bluetooth speakers, this device, other phones with the
  // page open: they can be indoors or out); outdoor / indoor: the house speakers
  groupOuts(outs, g) {
    const me = "browser:" + SB.deviceId;
    if (g === "devices") {
      // portable ones: Bluetooth speakers first, then this device, then other phones with the page open
      const rank = (o) => (o.kind === "bluetooth" ? 0 : o.id === me ? 1 : 2);
      return outs.filter((o) => o.kind === "bluetooth" || (o.kind === "browser" && (o.id === me || o.available))).sort((a, b) => rank(a) - rank(b));
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
    this.setHTML(".fx-sub", q.running ? T("playing") : pending ? T("queued_n", pending) : SB.state.settings.haunt?.on ? MODE : "");
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
    // voices in a language that isn't shown are left out everywhere, counts included
    const langs = SB.voiceLangs(), shownL = SB.shownLangs();
    const all = lib.sfx.filter((s) => SB.langOk(s, shownL));
    const hiddenN = all.filter((s) => SB.isHidden(s.id)).length;
    const downN = all.filter((s) => SB.marks(s.id).down).length;
    const showHidden = ui.showHidden;
    const visible = all.filter((s) => showHidden || !SB.isHidden(s.id));
    const favN = visible.filter((s) => SB.marks(s.id).fav).length;
    const catIds = [...new Set(all.map((s) => s.category))].sort((a, b) =>
      (cats[a]?.order ?? 99) - (cats[b]?.order ?? 99) || a.localeCompare(b));
    const counts = {};
    for (const s of visible) counts[s.category] = (counts[s.category] || 0) + 1;
    const langSeg = langs.length > 1 ? `<div class="seg vlangs" role="group" aria-label="${T("voices_t")}" title="${T("voices_t")}"><span class="seg-l">🗣️</span>${langs.map((l) =>
      `<button class="${shownL.includes(l) ? "on" : ""}" data-act="vlang" data-id="${l}" aria-pressed="${shownL.includes(l)}" title="${T("voices_in", l)}">${l.toUpperCase()}</button>`).join("")}</div>` : "";
    this.setHTML(".bank-tools", `
      <div class="search"><ha-icon icon="mdi:magnify"></ha-icon><input type="search" placeholder="${T("search_n", visible.length)}" value="${esc(ui.filter)}" data-act="filter" aria-label="${T("search")}"></div>
      <div class="seg" role="group" aria-label="${T("tap_does")}">${[["queue", "mdi:playlist-plus", T("mode_play"), T("mode_play_t")], ["preview", "mdi:headphones", T("mode_preview"), T("mode_preview_t")]]
        .map(([k, ic, l, tt]) => `<button class="${ui.tapMode === k ? "on" : ""}" data-act="mode" data-mode="${k}" title="${tt}"><ha-icon icon="${ic}"></ha-icon> ${l}</button>`).join("")}</div>
      ${langSeg}
      ${this.config.guest || !hiddenN ? "" : `<label class="tog sm" title="${T("show_hidden_t")}">
        <input type="checkbox" data-act="showhidden" ${showHidden ? "checked" : ""}> ${T("show_hidden")} <small class="muted">${hiddenN}${downN ? ` · ${downN} 👎` : ""}</small></label>`}`);
    if (ui.category === "fav" && !favN) ui.category = "all";
    // a category remembered from another theme, or emptied by the language choice
    if (ui.category !== "all" && ui.category !== "fav" && !counts[ui.category]) ui.category = "all";
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
        ${s.lang && shownL.length > 1 ? `<span class="t-lang" title="${T("voices_in", s.lang)}">${esc(s.lang.toUpperCase())}</span>` : ""}
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
      case "htest": SB.hushTest(); break;
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
      case "scene": {
        const sc = (SB.lib?.scenes || []).find((x) => x.id === b.dataset.id);
        if (!sc) break;
        if (!st.settings.sfx.speakers.length) { this.toast(T("tick_first")); break; }
        SB.unlock();
        b.classList.remove("flash"); void b.offsetWidth; b.classList.add("flash");
        SB.ws({ type: "soundboard/queue", action: "add", items: this.sceneItems(sc).slice(0, 50) });
        break;
      }
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
      case "vlang": {
        const shown = SB.shownLangs(), l = b.dataset.id;
        const next = shown.includes(l) ? shown.filter((x) => x !== l) : SB.voiceLangs().filter((x) => x === l || shown.includes(x));
        if (next.length) SB.patch({ voice_langs: next.length === SB.voiceLangs().length ? [] : next });
        break;
      }
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
    a.download = `soundboard-${SB.libTheme}-${new Date().toISOString().slice(0, 10)}.json`;
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
    if (["gap", "mcool", "hmin", "hmax", "hhold"].includes(t.dataset.act)) { const el = t.nextElementSibling; if (el) el.textContent = `${t.value}s`; }
    if (t.dataset.act === "hsens") { const el = t.nextElementSibling; if (el) el.textContent = `${t.value}/10`; }
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
      case "hush": if (t.checked) SB.hushArm(); SB.patch({ hush: { on: t.checked } }); break;
      case "hsens": SB.patch({ hush: { sens: +t.value } }); break;
      case "hhold": SB.patch({ hush: { hold_s: +t.value } }); break;
    }
  }

  toast(msg) {
    this.dispatchEvent(new CustomEvent("hass-notification", { detail: { message: msg }, bubbles: true, composed: true }));
  }
}

// Always dark, whatever the HA theme. Text font: Bricolage Grotesque; each look brings its display
// font (night: Pirata One, winter: Berkshire Swash), all SIL OFL, served from www/fonts/ (see LOOKS).
const STYLE = `
/* palette slots: the night look's values here, other looks override them below */
:host { --sb-accent:#ff7518; --sb-accent2:#9b59ff; --ink:#0c0a11; --ink-top:#120e19; --panel:rgba(26,20,36,.74); --line:rgba(241,232,214,.10);
  --fg:#f1e8d6; --mute:rgba(241,232,214,.62); --live:#8dffa6; --danger:#d7263d; --title:#ffe9c7; --on-accent:#1a0f00;
  --accent-hi:color-mix(in srgb, var(--sb-accent) 85%, #ffd27a); --tile-ink:#15111c; --bar-bg:rgba(12,10,17,.86); --card-bg:#18121f;
  --sb-sticky-top:var(--header-height, 0px);
  --display:"SB Night", Georgia, serif; --text:"SB Body", "Bricolage Grotesque", ui-rounded, "Segoe UI", sans-serif;
  display:block; }
* { box-sizing:border-box; }
.wrap { position:relative; isolation:isolate; max-width:1240px; margin:0 auto; padding:14px; display:flex; flex-direction:column; gap:14px;
  color:var(--fg); font-family:var(--text); color-scheme:dark; border-radius:24px;
  background:
    radial-gradient(900px 420px at 88% -8%, color-mix(in srgb, var(--sb-accent2) 26%, transparent), transparent 70%),
    radial-gradient(700px 380px at -10% 108%, color-mix(in srgb, var(--sb-accent) 16%, transparent), transparent 70%),
    linear-gradient(180deg, var(--ink-top), var(--ink) 40%); }
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
.title { font-family:var(--display); font-size:46px; line-height:.95; letter-spacing:.01em; color:var(--title);
  text-shadow:0 0 18px color-mix(in srgb, var(--sb-accent) 65%, transparent), 0 2px 0 #000; animation:candle 4s infinite; }
@keyframes candle { 0%,100% { opacity:1; } 42% { opacity:.93; } 44% { opacity:1; } 71% { opacity:.96; } }
.subtitle { font-size:12px; color:var(--mute); letter-spacing:.22em; text-transform:uppercase; margin-top:6px; }
.themes { display:flex; gap:6px; flex-wrap:wrap; }
.bar { position:sticky; top:var(--sb-sticky-top); z-index:5; display:grid; grid-template-columns:1fr 1fr auto; gap:8px; padding:8px;
  border-radius:20px; border:1px solid var(--line); background:var(--bar-bg); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
  box-shadow:0 12px 30px -18px #000; }
.tab { border:1px solid var(--line); background:rgba(255,255,255,.035); border-radius:14px; padding:8px 6px; display:flex; flex-direction:column; align-items:center; gap:1px; min-width:0; transition:background .2s, border-color .2s, box-shadow .2s; }
.tab-l { font-weight:750; font-size:15px; white-space:nowrap; }
.tab-sub { font-size:11.5px; color:var(--mute); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
.tab.on { border-color:var(--sb-accent); background:linear-gradient(180deg, color-mix(in srgb, var(--sb-accent) 26%, transparent), color-mix(in srgb, var(--sb-accent) 8%, transparent));
  box-shadow:0 0 22px -8px var(--sb-accent), inset 0 1px 0 rgba(255,255,255,.12); }
.tab.on .tab-sub { color:var(--fg); }
.stopall { border:0; border-radius:14px; padding:0 16px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; font-size:13px;
  background:linear-gradient(180deg, #e63950, #a3162a); color:#fff; display:flex; gap:6px; align-items:center; justify-content:center;
  box-shadow:0 6px 18px -8px var(--danger), inset 0 1px 0 rgba(255,255,255,.25); }
.stopall.live { animation:throb 1.6s ease-in-out infinite; }
@keyframes throb { 50% { box-shadow:0 0 0 4px color-mix(in srgb, var(--danger) 35%, transparent), 0 6px 18px -8px var(--danger); } }
.stopall:active { transform:scale(.96); }
/* floats over the page: it disappears on the first tap, and a banner in the flow would shift
   everything under the finger between pointerdown and click, so that tap would miss its button */
.lock { position:fixed; z-index:20; left:50%; bottom:max(16px, env(safe-area-inset-bottom)); transform:translateX(-50%); width:min(calc(100% - 32px), 520px);
  padding:14px; border-radius:16px; background:linear-gradient(90deg, var(--sb-accent), color-mix(in srgb, var(--sb-accent) 70%, #ffd27a)); color:var(--on-accent);
  font-weight:700; text-align:center; cursor:pointer; box-shadow:0 10px 40px -8px #000, 0 0 30px -10px var(--sb-accent); animation:rise .4s both; }
.sec { background:var(--panel); border-radius:22px; border:1px solid var(--line); box-shadow:0 20px 40px -30px #000, inset 0 1px 0 rgba(255,255,255,.04); }
.sec.off-tab { display:none; }
.sec-h { margin:0; padding:14px 16px 10px; font-family:var(--display); font-weight:400; font-size:28px; line-height:1; letter-spacing:.01em; display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none; color:var(--title); }
.sec-sub { margin-left:auto; font-family:var(--text); font-size:12px; font-weight:600; color:var(--live); max-width:50%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
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
.dev-cols .dev-n { flex-wrap:wrap; gap:4px 8px; }
.chip.warm.sm { padding:3px 9px 3px 6px; font-size:11.5px; font-weight:700; gap:3px; text-transform:none; letter-spacing:0; }
.chip.warm.sm ha-icon { --mdc-icon-size:14px; }
.warm.on { background:color-mix(in srgb, var(--live) 18%, transparent); border-color:var(--live); }
.dot { width:8px; height:8px; border-radius:50%; display:inline-block; flex:none; }
.dot.warm { background:var(--live); box-shadow:0 0 8px var(--live); }
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
.via-b span:first-of-type { flex:1; color:var(--fg); }
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
.btn.primary { background:linear-gradient(180deg, var(--accent-hi), var(--sb-accent)); border-color:transparent; color:var(--on-accent); font-weight:800; box-shadow:0 8px 20px -10px var(--sb-accent); }
.btn.danger { color:#ff8a98; border-color:color-mix(in srgb, var(--danger) 50%, transparent); }
.btn:disabled { opacity:.35; cursor:default; box-shadow:none; }
.btn:not(:disabled):active { transform:scale(.96); }
.stepper { display:inline-flex; align-items:center; gap:6px; }
.stepper b { min-width:34px; text-align:center; font-variant-numeric:tabular-nums; }
.tog { display:inline-flex; gap:7px; align-items:center; font-size:14px; font-weight:600; user-select:none; cursor:pointer; }
.tog.sm { font-size:13px; font-weight:500; color:var(--mute); }
.tog input, .track input { accent-color:var(--sb-accent); width:18px; height:18px; }
.tracks { display:flex; flex-direction:column; gap:14px; }
.tracks-in { display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:4px 12px; }
.tgroup { display:flex; flex-direction:column; gap:6px; }
.tgroup > .lbl { padding-left:10px; }
.m-lang { display:inline-block; padding:0 5px; margin-left:4px; border-radius:6px; font-size:10px; font-weight:800; letter-spacing:.05em;
  color:var(--mute); border:1px solid var(--line); vertical-align:1px; }
.track-w { display:flex; flex-direction:column; border-radius:12px; border:1px solid transparent; }
.track-w.sel { background:color-mix(in srgb, var(--sb-accent) 9%, transparent); border-color:color-mix(in srgb, var(--sb-accent) 35%, transparent); }
.track { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:12px; cursor:pointer; }
.track:hover { background:rgba(255,255,255,.04); }
.track.playing .t-title { color:var(--live); }
.t-title { flex:1; font-weight:600; }
.dur { font-size:12px; color:var(--mute); font-variant-numeric:tabular-nums; }
.np { display:flex; flex-direction:column; gap:4px; padding:10px 12px; border-radius:14px; background:rgba(0,0,0,.25); border:1px solid color-mix(in srgb, var(--live) 25%, transparent); }
.np-row { display:flex; align-items:center; gap:10px; font-weight:700; }
.np-t { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.bar-p { height:4px; border-radius:2px; background:rgba(255,255,255,.08); overflow:hidden; margin:2px 0 6px; }
.fill, .q-bar { display:block; height:100%; background:var(--live); transform-origin:left; animation-name:prog; animation-timing-function:linear; animation-fill-mode:both; }
@keyframes prog { from { transform:scaleX(0); } to { transform:scaleX(1); } }
.eq { display:inline-flex; gap:2px; align-items:flex-end; height:14px; }
.eq i { width:3px; background:var(--live); animation:eq .9s infinite ease-in-out; border-radius:1px; }
.eq i:nth-child(2) { animation-delay:-.3s; } .eq i:nth-child(3) { animation-delay:-.6s; }
@keyframes eq { 0%,100% { height:4px; } 50% { height:14px; } }
.queue { min-height:20px; }
.q-items { display:flex; flex-wrap:wrap; gap:6px; }
.q { position:relative; display:inline-flex; align-items:center; gap:4px; padding:6px 4px 6px 10px; border-radius:12px; background:rgba(255,255,255,.05); border:1px solid var(--line); font-size:13px; overflow:hidden; max-width:220px; }
.q.done { opacity:.4; }
.q-spin { width:12px; height:12px; border-radius:50%; border:2px solid color-mix(in srgb, var(--sb-accent) 30%, transparent); border-top-color:var(--sb-accent); animation:sbspin .8s linear infinite; flex:none; }
@keyframes sbspin { to { transform:rotate(360deg); } }
.q.error { border-color:var(--danger); }
.q.cur { border-color:var(--live); box-shadow:0 0 14px -4px var(--live); }
.q-t { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.q-n { font-size:11px; opacity:.6; }
.q-x { border:0; background:none; font-size:16px; line-height:1; padding:0 6px; opacity:.6; }
.q-bar { position:absolute; left:0; bottom:0; height:3px; width:100%; }
.gapchip { border-style:dashed; }
.bank-tools { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.seg { display:inline-flex; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
.seg button { border:0; background:rgba(255,255,255,.04); padding:8px 11px; display:inline-flex; gap:5px; align-items:center; font-size:13px; font-weight:600; }
.seg button + button { border-left:1px solid var(--line); }
.seg button.on { background:var(--sb-accent); color:var(--on-accent); font-weight:800; }
.search { flex:1 1 220px; display:flex; align-items:center; gap:6px; border:1px solid var(--line); border-radius:12px; padding:0 12px; background:rgba(0,0,0,.3); }
.search:focus-within { border-color:var(--sb-accent); }
.search ha-icon { color:var(--mute); }
.search input { flex:1; border:0; background:none; color:inherit; font:inherit; padding:10px 0; outline:none; min-width:0; }
.cats { display:flex; gap:6px; overflow-x:auto; padding:2px 2px 6px; scrollbar-width:thin; scroll-snap-type:x proximity; -webkit-mask-image:linear-gradient(90deg, #000 92%, transparent); mask-image:linear-gradient(90deg, #000 92%, transparent); }
.cats .chip { scroll-snap-align:start; }
.cat-h { font-family:var(--display); font-size:22px; margin:12px 0 8px; color:var(--title); display:flex; align-items:center; gap:8px; }
.cat-h span { font-size:18px; }
.tiles { display:grid; grid-template-columns:repeat(auto-fill, minmax(124px, 1fr)); gap:10px; }
.tile { position:relative; border:1px solid var(--line); border-radius:18px; padding:12px 6px 5px; min-height:108px; cursor:pointer;
  background:linear-gradient(165deg, rgba(255,255,255,.075), rgba(255,255,255,.015) 60%), color-mix(in srgb, var(--sb-accent2) 7%, var(--tile-ink));
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; text-align:center; user-select:none; touch-action:manipulation;
  transition:transform .14s ease, border-color .2s, box-shadow .25s; }
/* the tiles rise in once, when the bank first shows; not on every re-render (each queue change re-renders it) */
.bank.intro .tile { animation:rise .5s both; animation-delay:calc(var(--i, 0) * 14ms); }
@keyframes rise { from { opacity:0; transform:translateY(8px); } }
.tile:hover { border-color:color-mix(in srgb, var(--sb-accent) 70%, transparent); box-shadow:0 14px 28px -16px var(--sb-accent); transform:translateY(-2px); }
.tile:active { transform:scale(.95); }
.tile.flash { animation:flash .5s ease-out; }
@keyframes flash { 0% { box-shadow:0 0 0 0 var(--sb-accent); background:color-mix(in srgb, var(--sb-accent) 40%, var(--tile-ink)); } 100% { box-shadow:0 0 0 14px transparent; } }
.tile.now { border-color:var(--live); box-shadow:0 0 0 1px var(--live), 0 0 28px -6px var(--live); }
.tile.now .t-e { animation:haunt .9s ease-in-out infinite; }
@keyframes haunt { 50% { transform:scale(1.15) rotate(-6deg); } }
.t-q { position:absolute; top:6px; right:8px; min-width:18px; height:18px; padding:0 5px; border-radius:9px; background:var(--sb-accent); color:var(--on-accent); font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; }
.t-e { font-size:32px; line-height:1; filter:drop-shadow(0 6px 10px rgba(0,0,0,.55)); transition:transform .2s; }
.tile:hover .t-e { transform:scale(1.12) rotate(-6deg); }
.t-n { font-size:13px; line-height:1.2; font-weight:650; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.t-d { font-size:11px; color:var(--mute); }
.tile.hidden-s, .track.hidden-s { opacity:.45; border-style:dashed; }
.tile.is-down { border-color:var(--danger); }
.tile.is-fav { border-color:color-mix(in srgb, #ff4d8d 55%, var(--line)); }
.t-row { display:flex; align-items:center; justify-content:center; gap:1px; margin-top:2px; }
.track .t-row { margin:0; }
.ic { border:0; background:none; padding:3px; border-radius:8px; line-height:0; opacity:.38; display:inline-flex; }
.ic ha-icon { --mdc-icon-size:16px; }
.ic:hover { opacity:.9; background:rgba(255,255,255,.08); }
.ic.on { opacity:1; }
.ic.fav.on { color:#ff4d8d; }
.ic.down.on { color:var(--danger); }
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
.scenes:empty { display:none; }
.scenes-in { display:flex; flex-direction:column; gap:8px; }
.scenes-in .chips { display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:8px; }
.chip.scene { padding:9px 12px; font-weight:700; white-space:normal; text-align:left; line-height:1.2; border-radius:14px; border-color:color-mix(in srgb, var(--sb-accent2) 55%, transparent);
  background:linear-gradient(180deg, color-mix(in srgb, var(--sb-accent2) 22%, transparent), color-mix(in srgb, var(--sb-accent2) 8%, transparent)); }
.chip.scene small { margin-left:auto; padding-left:4px; white-space:nowrap; }
.chip.scene .sc-e { font-size:17px; line-height:1; }
.chip.scene.flash { animation:flash .5s ease-out; }
.haunt-in, .motion, .hush-p { display:flex; flex-direction:column; gap:8px; padding:12px 14px; border-radius:14px; border:1px solid var(--line); background:rgba(0,0,0,.2); transition:border-color .3s, box-shadow .3s; }
.haunt-in.on, .motion.on, .hush-p.on { border-color:var(--live); box-shadow:0 0 26px -12px var(--live); }
.haunt-in.on .tog.big, .hush-p.on .tog.big { color:var(--live); }
.hush-p .gap input { flex:1 1 120px; }
.hush-status:empty { display:none; }
.hush-w { display:flex; flex-direction:column; gap:6px; }
.hush-chart { display:block; width:100%; height:130px; border-radius:10px; background:rgba(0,0,0,.28); border:1px solid var(--line); }
.hush-leg { display:flex; flex-wrap:wrap; gap:4px 14px; font-size:12px; color:var(--mute); }
.hush-leg .sw { display:inline-block; width:16px; height:2px; border-radius:2px; margin-right:6px; vertical-align:middle; }
.sw.lv { background:var(--fg); }
.sw.th { background:repeating-linear-gradient(90deg, var(--sb-accent) 0 5px, transparent 5px 9px); }
.sw.ow { height:10px; background:rgba(180,190,205,.3); }
.sw.tr { width:2px; height:12px; background:var(--live); }
.sw.hd { height:10px; background:repeating-linear-gradient(135deg, rgba(255,255,255,.22) 0 2px, transparent 2px 5px); border:1px solid rgba(255,255,255,.18); }
.h-opts summary { cursor:pointer; font-size:13.5px; font-weight:700; padding:2px 0; }
.h-opts[open] { display:flex; flex-direction:column; gap:10px; }
.h-opts .ctl-line { flex-wrap:wrap; }
.h-opts .gap input { flex:1 1 90px; }
.aim { position:fixed; inset:0; z-index:30; background:rgba(5,3,8,.62); backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; padding:16px; }
.aim[hidden] { display:none; }
.aim-card { width:min(100%, 540px); background:var(--card-bg); border:1px solid var(--line); border-radius:20px; padding:18px; display:flex; flex-direction:column; gap:12px; box-shadow:0 30px 80px -20px #000, 0 0 40px -20px var(--sb-accent); animation:rise .25s both; }
.aim-h { font-family:var(--display); font-size:26px; color:var(--title); line-height:1.1; }
.ic.aim-b { color:var(--sb-accent); }
.langs { display:flex; gap:4px; }
.chip.lang { padding:5px 10px; font-weight:800; font-size:12px; }
.offline { align-self:flex-start; }
.offline.done { border-color:var(--live); color:var(--live); }
.aim-g { display:flex; flex-direction:column; gap:6px; }
.seg-l { display:inline-flex; align-items:center; padding:0 4px 0 9px; font-size:14px; }
.vlangs button { padding:8px 10px; font-weight:800; font-size:12px; letter-spacing:.04em; }
.t-lang { position:absolute; top:6px; left:8px; padding:1px 5px; border-radius:6px; font-size:9.5px; font-weight:800; letter-spacing:.05em;
  color:var(--mute); border:1px solid var(--line); background:rgba(0,0,0,.25); }
/* the look's scene: its children are laid out as if they were the .wrap's own */
.backdrop { display:contents; }

/* ---------- winter look: snowfall, stars, a string of lights, the sleigh, Saint Nicholas ---------- */
:host([data-look="winter"]) { --ink:#06101b; --ink-top:#0d2236; --panel:rgba(12,26,41,.84); --line:rgba(225,238,255,.11);
  --fg:#f2f6fb; --mute:rgba(222,234,248,.64); --live:#ffd76e; --title:#fff1d6; --on-accent:#fff;
  --accent-hi:color-mix(in srgb, var(--sb-accent) 80%, #ff9d8a); --tile-ink:#0d1a29; --bar-bg:rgba(6,16,27,.86); --card-bg:#0f1d2d;
  --display:"SB Winter", Georgia, serif; }
:host([data-look="winter"]) .wrap { padding-top:30px; }
:host([data-look="winter"]) .title { letter-spacing:0; text-shadow:0 0 22px color-mix(in srgb, var(--sb-accent2) 60%, transparent), 0 2px 0 #000; }
:host([data-look="winter"]) .sec-h, :host([data-look="winter"]) .cat-h { letter-spacing:0; }
:host([data-look="winter"]) .tile.now .t-e { animation:ring .7s ease-in-out infinite; transform-origin:50% 10%; }
@keyframes ring { 0%, 100% { transform:rotate(0); } 25% { transform:rotate(14deg); } 75% { transform:rotate(-14deg); } }
/* snow: three layers of flakes, each a repeating tile that falls by exactly one tile height and
   sways; on the public page it covers the screen, in Home Assistant the top of the card */
.snow { position:absolute; left:0; right:0; top:0; height:min(100%, 1100px); z-index:-1; overflow:hidden; pointer-events:none; border-radius:inherit;
  -webkit-mask-image:linear-gradient(#000 55%, transparent); mask-image:linear-gradient(#000 55%, transparent); }
.wrap.standalone .snow { position:fixed; inset:0; height:auto; -webkit-mask-image:none; mask-image:none; }
.snow i { position:absolute; left:-40px; right:-40px; top:calc(-1 * var(--t)); bottom:0; background-size:var(--t) var(--t);
  animation:snow var(--d) linear infinite, sway var(--sw) ease-in-out infinite alternate; will-change:transform; }
.snow .s1 { --t:170px; --d:30s; --sw:7s; opacity:.55;
  background-image:radial-gradient(circle at 20px 30px, #fff 0 1px, transparent 1.6px), radial-gradient(circle at 95px 80px, #fff 0 1.2px, transparent 1.8px),
    radial-gradient(circle at 140px 140px, #fff 0 .9px, transparent 1.5px), radial-gradient(circle at 60px 120px, #fff 0 1px, transparent 1.6px); }
.snow .s2 { --t:260px; --d:21s; --sw:5s; opacity:.75;
  background-image:radial-gradient(circle at 40px 60px, #fff 0 1.8px, transparent 2.5px), radial-gradient(circle at 190px 30px, #fff 0 1.5px, transparent 2.2px),
    radial-gradient(circle at 130px 190px, #fff 0 2px, transparent 2.7px); }
.snow .s3 { --t:420px; --d:14s; --sw:4s; opacity:.8; filter:blur(.6px);
  background-image:radial-gradient(circle at 70px 110px, #fff 0 2.8px, transparent 3.8px), radial-gradient(circle at 320px 300px, #fff 0 2.4px, transparent 3.4px); }
@keyframes snow { from { transform:translateY(0); } to { transform:translateY(var(--t)); } }
@keyframes sway { from { translate:-14px 0; } to { translate:14px 0; } }
/* the sky band: the moon, stars, the sleigh, Saint Nicholas */
.sky { position:absolute; left:0; right:0; top:0; height:190px; overflow:hidden; pointer-events:none; z-index:0; border-radius:24px 24px 0 0; }
.sky .moon { position:absolute; right:22%; top:26px; width:70px; height:70px; border-radius:50%;
  background:radial-gradient(circle at 38% 36%, #ffffff, #e9f0fb 55%, #bccbe4);
  box-shadow:0 0 30px 8px rgba(220,232,255,.35), 0 0 90px 34px rgba(255,214,140,.10); opacity:.95; }
.sky .moon::after { content:""; position:absolute; inset:0; border-radius:50%;
  background:radial-gradient(circle at 64% 60%, rgba(120,140,180,.28) 0 9%, transparent 10%), radial-gradient(circle at 34% 68%, rgba(120,140,180,.2) 0 6%, transparent 7%); }
.star { position:absolute; width:3px; height:3px; border-radius:50%; background:#fff; box-shadow:0 0 6px 1px rgba(255,255,255,.8); animation:twinkle var(--k, 3s) ease-in-out infinite; }
.t1 { left:8%; top:120px; --k:3.4s; } .t2 { left:31%; top:22px; --k:2.6s; animation-delay:-1s; } .t3 { left:46%; top:96px; --k:4s; }
.t4 { left:58%; top:30px; --k:3s; animation-delay:-2s; } .t5 { left:88%; top:110px; --k:2.2s; } .t6 { left:94%; top:34px; --k:3.6s; animation-delay:-.5s; }
.t7 { left:70%; top:140px; --k:2.8s; animation-delay:-1.4s; } .t8 { left:18%; top:64px; --k:3.2s; animation-delay:-2.4s; }
@keyframes twinkle { 50% { opacity:.25; transform:scale(.6); } }
.sleigh { position:absolute; left:-280px; top:16px; width:210px; animation:sleigh-x 32s linear infinite; animation-delay:-9s; }
.sleigh .bob { display:block; animation:sleigh-bob 4s ease-in-out infinite alternate; }
.sleigh svg { display:block; width:100%; overflow:visible; fill:#0b1626; stroke:#0b1626; stroke-width:1.6; stroke-linecap:round;
  filter:drop-shadow(0 0 2px rgba(255,220,140,.95)) drop-shadow(0 0 9px rgba(255,200,110,.45)); }
.sleigh path:not(.ant):not(.lf):not(.lb):not(.reins) { stroke:none; }
.sleigh .reins { fill:none; stroke-width:1; }
.sleigh .ant { fill:none; stroke-width:1.4; }
.sleigh .lf, .sleigh .lb, .nicolas .lf, .nicolas .lb { transform-box:fill-box; transform-origin:50% 0; animation:gallop .45s ease-in-out infinite alternate; }
.sleigh .lb { animation-delay:-.22s; }
.sleigh .lf, .sleigh .lb { fill:none; stroke-width:1.5; }
/* a trail of sparkles behind the sleigh */
.sleigh::before { content:""; position:absolute; right:100%; top:58%; width:150px; height:8px; margin-right:-12px;
  background:radial-gradient(circle, #ffe6a6 0 1.1px, transparent 1.8px) 0 0 / 11px 8px repeat-x;
  -webkit-mask-image:linear-gradient(90deg, transparent, #000); mask-image:linear-gradient(90deg, transparent, #000); animation:sparkle .6s steps(3) infinite; }
@keyframes sparkle { 50% { opacity:.5; } }
@keyframes sleigh-x { from { left:-280px; } to { left:calc(100% + 80px); } }
@keyframes sleigh-bob { from { transform:translateY(-6px) rotate(-3deg); } to { transform:translateY(10px) rotate(2deg); } }
@keyframes gallop { from { transform:rotate(-22deg); } to { transform:rotate(22deg); } }
/* he walks in from the right, about halfway across the header, and fades into the night */
.nicolas { position:absolute; right:-120px; top:64px; width:88px; animation:walk-x 64s linear infinite; animation-delay:-14s; }
.nicolas .step { display:block; animation:step .9s ease-in-out infinite alternate; }
.nicolas svg { display:block; width:100%; overflow:visible; fill:#0b1626; stroke:#0b1626;
  filter:drop-shadow(0 0 2px rgba(255,220,140,.9)) drop-shadow(0 0 8px rgba(255,200,110,.35)); }
.nicolas path:not(.crozier) { stroke:none; }
.nicolas .crozier { fill:none; stroke-width:2.4; stroke-linecap:round; }
.nicolas .fruit { fill:#ffa94d; filter:drop-shadow(0 0 3px rgba(255,160,60,.9)); }
.nicolas .lf, .nicolas .lb { animation-duration:.9s; }
.nicolas .lb { animation-delay:-.45s; }
@keyframes walk-x { 0% { right:-120px; opacity:1; } 58% { right:52%; opacity:1; } 64%, 100% { right:56%; opacity:0; } }
@keyframes step { from { transform:translateY(0); } to { transform:translateY(-2px); } }
/* a string of lights along the top, each bulb twinkling on its own beat */
.lights { position:absolute; left:0; right:0; top:0; height:32px; display:flex; overflow:hidden; pointer-events:none; z-index:2; border-radius:24px 24px 0 0; }
.lights svg { flex:none; width:120px; height:34px; overflow:visible; }
.lights path { fill:none; stroke:#16301f; stroke-width:1.6; }
.lights ellipse { animation:bulb 2.6s ease-in-out infinite; }
.lights svg:nth-child(3n+1) ellipse:nth-of-type(1), .lights svg:nth-child(3n+2) ellipse:nth-of-type(2), .lights svg:nth-child(3n) ellipse:nth-of-type(3) { --c:#ff4d5a; }
.lights svg:nth-child(3n+1) ellipse:nth-of-type(2), .lights svg:nth-child(3n+2) ellipse:nth-of-type(3), .lights svg:nth-child(3n) ellipse:nth-of-type(1) { --c:#ffd56b; }
.lights svg:nth-child(3n+1) ellipse:nth-of-type(3), .lights svg:nth-child(3n+2) ellipse:nth-of-type(1), .lights svg:nth-child(3n) ellipse:nth-of-type(2) { --c:#5fd38d; }
.lights svg:nth-child(4n) ellipse:nth-of-type(2) { --c:#6cc4ff; }
.lights ellipse { fill:var(--c); filter:drop-shadow(0 0 4px var(--c)) drop-shadow(0 0 10px var(--c)); }
.lights svg:nth-child(2n) ellipse { animation-delay:-1.3s; } .lights svg:nth-child(3n) ellipse:nth-of-type(2) { animation-delay:-.6s; }
.lights svg:nth-child(5n) ellipse:nth-of-type(1) { animation-delay:-2s; animation-duration:1.9s; }
@keyframes bulb { 50% { opacity:.45; } }
@media (max-width: 520px) {
  .sleigh { width:160px; top:10px; }
  .nicolas { width:72px; top:98px; }
  .sky .moon { right:7%; top:64px; width:54px; height:54px; }
  :host([data-look="winter"]) .wrap { padding-top:26px; }
}
`;

if (!customElements.get("soundboard-card")) {
  customElements.define("soundboard-card", SoundboardCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "soundboard-card", name: "Soundboard", description: "Themed music + sound-effect queue for the house speakers." });
}
