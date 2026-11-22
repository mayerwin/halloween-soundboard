// The page around the card: an <ha-icon> stand-in (the card is written for Home Assistant's
// frontend), the in-browser engine, the page's words in English / French, the credits dialog,
// toasts, and the offline app (service worker + install button).
// What differs from one theme's site to another is data: site.json (this site's words and its
// storage key, written by the export) and library.json (the theme itself).
import { ICONS } from "./icons.js";
import { LocalSoundboard } from "./soundboard-local.js";

customElements.define("ha-icon", class extends HTMLElement {
  static get observedAttributes() { return ["icon"]; }
  connectedCallback() { this.render(); }
  attributeChangedCallback() { this.render(); }
  render() {
    const d = ICONS[(this.getAttribute("icon") || "").replace("mdi:", "")] || "";
    this.style.display = "inline-flex";
    this.style.verticalAlign = "middle";
    this.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" style="width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);fill:currentColor"><path d="${d}"/></svg>`;
  }
});

// words every theme's page shares; site.json "words" adds the theme's own (title, tip, credits line...)
const PAGE = {
  en: {
    title: "Soundboard", loading: "Loading the sounds…", install: "📲 Install the app",
    full_credits: "Full credits", source: "Source on GitHub", privacy: "Nothing you do here leaves your browser: favourites, hidden sounds and presets are stored on this device only.",
    credits: "Credits", credits_intro: "Every sound below belongs to its author and is used under the license shown. Thank you! We claim no rights over these sounds. Some licenses (CC BY-NC) forbid commercial use.",
    by: "by", source_l: "source", streamed: "played from its site", music: "Music", ambience: "Ambiences", unknown: "unknown",
    load_failed: "The soundboard failed to load. Try reloading the page.",
    caching: (d, t) => `Downloading sounds for offline use… ${d}/${t}`, cached: (f) => f ? `Ready offline (${f} sounds could not be saved and need a connection).` : "Ready offline: every sound is saved on this device.",
    no_sw: "Offline mode needs a recent browser (service workers).", update: "A new version is ready: reload to use it.",
  },
  fr: {
    title: "Boîte à sons", loading: "Chargement des sons…", install: "📲 Installer l'appli",
    full_credits: "Tous les crédits", source: "Code source sur GitHub", privacy: "Rien de ce que vous faites ici ne quitte votre navigateur : favoris, sons masqués et préréglages restent sur cet appareil.",
    credits: "Crédits", credits_intro: "Chaque son ci-dessous appartient à son auteur et est utilisé selon la licence indiquée. Merci ! Nous ne revendiquons aucun droit sur ces sons. Certaines licences (CC BY-NC) interdisent l'usage commercial.",
    by: "par", source_l: "source", streamed: "lu depuis son site", music: "Musique", ambience: "Ambiances", unknown: "inconnu",
    load_failed: "La boîte à sons n'a pas pu se charger. Rechargez la page.",
    caching: (d, t) => `Téléchargement des sons pour le mode hors ligne… ${d}/${t}`, cached: (f) => f ? `Prêt hors ligne (${f} sons n'ont pas pu être enregistrés et demandent une connexion).` : "Prêt hors ligne : tous les sons sont enregistrés sur cet appareil.",
    no_sw: "Le mode hors ligne demande un navigateur récent (service workers).", update: "Une nouvelle version est prête : rechargez pour l'utiliser.",
  },
};
let SITE = { words: {} };
const stored = () => { try { return JSON.parse(localStorage.getItem("soundboard.lang")); } catch (e) { return null; } };
let lang = stored() || (/^fr/i.test((navigator.languages || [navigator.language]).join(",")) ? "fr" : "en");
const P = (k, ...a) => {
  const v = SITE.words[lang]?.[k] ?? PAGE[lang][k] ?? SITE.words.en?.[k] ?? PAGE.en[k];
  return typeof v === "function" ? v(...a) : v;
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let toastT;
function toast(msg, ms = 3200) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("on"), ms);
}

let LIB = null;
function applyLang() {
  document.documentElement.lang = lang;
  if (SITE.words.en) document.title = P("title");
  // before site.json is in, the theme's own words aren't known yet: those keep the page's text
  for (const el of document.querySelectorAll("[data-i18n]")) { const v = P(el.dataset.i18n); if (v != null) el.textContent = v; }
  if (LIB) credits(LIB);
}

function credits(lib) {
  const cats = lib.categories || {};
  const catName = (c) => (lang === "fr" && cats[c]?.name_fr) || cats[c]?.name || c;
  const rows = [...lib.music.map((i) => ({ ...i, cat: P(i.group === "music" ? "music" : "ambience") })), ...lib.sfx.map((i) => ({ ...i, cat: catName(i.category) }))];
  const byCat = new Map();
  for (const r of rows) (byCat.get(r.cat) || byCat.set(r.cat, []).get(r.cat)).push(r);
  document.getElementById("credits-list").innerHTML = [...byCat].map(([cat, list]) => `<h3>${esc(cat)}</h3><ul>${list.map((r) =>
    `<li><b>${esc((lang === "fr" && r.title_fr) || r.title)}</b> ${P("by")} ${esc(r.author || P("unknown"))}, ${esc(r.license)}${r.source_url ? `, <a href="${esc(r.source_url)}" rel="noopener" target="_blank">${P("source_l")}</a>` : ""}${/^https?:/.test(r.url) ? ` (${P("streamed")})` : ""}</li>`).join("")}</ul>`).join("");
}

// ----- offline app -----
// per theme: sibling sites share an origin, so one site's flag must not answer for another
const offlineKey = () => `soundboard.offline_done.${LIB?.id}`;
function offlineSetup(lib) {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").then((reg) => {
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w?.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) toast(P("update"), 6000); });
    });
  }).catch((e) => console.warn("service worker", e));
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type !== "cache-progress") return;
    const { done, total, failed } = e.data;
    if (done < total) toast(P("caching", done, total), 60000);
    else {
      toast(P("cached", failed), 6000);
      try { localStorage.setItem(offlineKey(), "true"); } catch (err) { /* blocked */ }
      document.querySelector("soundboard-card")?.update?.(true);
    }
  });
  let deferred = null;
  const btn = document.getElementById("install");
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; btn.hidden = false; });
  btn.onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; btn.hidden = true; };
  // every sound into the cache (a URL on another site would need CORS)
  const cacheAll = async () => {
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (!reg?.active) { toast(P("no_sw")); return; }
    const urls = [...lib.sfx, ...lib.music].map((i) => new URL(i.url, location.href).href);
    toast(P("caching", 0, urls.length), 60000);
    reg.active.postMessage({ type: "cache-all", urls });
  };
  document.addEventListener("soundboard-offline", cacheAll);
  // installed as an app: download everything at once, so it works with no connection
  window.addEventListener("appinstalled", cacheAll);
  let done = false;
  try { done = localStorage.getItem(offlineKey()) === "true"; } catch (e) { /* blocked */ }
  if (!done && (matchMedia("(display-mode: standalone)").matches || navigator.standalone)) cacheAll();
}

(async () => {
  applyLang();
  try {
    const [site, lib] = await Promise.all([fetch("./site.json").then((r) => r.json()), fetch("./library.json").then((r) => r.json())]);
    SITE = site;
    LIB = lib;
    applyLang();
    await import("./soundboard-card.js");
    const engine = new LocalSoundboard(lib, lang, { store: site.store });
    const card = document.createElement("soundboard-card");
    card.setConfig({ standalone: true });
    card.addEventListener("hass-notification", (e) => toast(e.detail.message));
    card.addEventListener("soundboard-lang", (e) => { lang = e.detail.lang; applyLang(); });
    // the page's own headings use the look's display font, which the card declares
    card.addEventListener("soundboard-look", (e) => { document.documentElement.dataset.look = e.detail.look; });
    card.hass = engine;
    document.getElementById("app").replaceChildren(card);
    credits(lib);
    document.getElementById("credits-open").onclick = () => document.getElementById("credits").showModal();
    offlineSetup(lib);
  } catch (e) {
    console.error(e);
    applyLang();
    document.querySelector(".loading p").textContent = P("load_failed");
  }
})();
