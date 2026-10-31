// build.mjs: src/ -> dist/ for GitHub Pages, with content-based cache busting.
//
//   node build.mjs [outdir]   (no dependencies; Node 18+; default outdir: dist/)
//
// GitHub Pages serves every file with a 10-minute cache and no way to set headers, so:
// - every script, stylesheet, font and data file gets its content hash in its name
//   (site.js -> site.3f2a9c1b04.js) and every reference to it is rewritten;
// - each sound keeps its name but library.json points at it with ?v=<content hash>;
// - index.html keeps its name (it's the entry point) and is the only file that can be stale,
//   for at most 10 minutes. A change anywhere changes the names it points at.
// Files are hashed leaves-first (a font before the card that names it, the card before
// site.js that imports it), so a name always covers everything it pulls in.
import { createHash } from "node:crypto";
import { cpSync, existsSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");
const DIST = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, "dist");
const HASHED = new Set([".js", ".css", ".json", ".woff2", ".svg"]);
const TEXT = new Set([".js", ".css", ".json", ".html", ".svg"]);
// names other sites / browsers ask for, or that must stay put (a service worker's URL is its identity)
const KEEP = new Set(["index.html", "favicon.svg", "sw.js", "manifest.webmanifest"]);

const hash = (buf, n = 10) => createHash("sha256").update(buf).digest("hex").slice(0, n);
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

rmSync(DIST, { recursive: true, force: true });
cpSync(SRC, DIST, { recursive: true });
const files = walk(DIST);

// sounds: ?v=<hash> in library.json
const libPath = join(DIST, "library.json");
const lib = JSON.parse(readFileSync(libPath, "utf8"));
for (const it of [...lib.sfx, ...lib.music]) {
  if (/^https?:/.test(it.url)) continue; // played from its origin
  const file = join(DIST, it.url.split("?")[0]);
  if (!existsSync(file)) throw new Error(`library.json names a missing sound: ${it.url}`);
  it.url = `${it.url.split("?")[0]}?v=${hash(readFileSync(file), 8)}`;
}
writeFileSync(libPath, JSON.stringify(lib));

// the rest: rename to name.<hash>.ext, leaves first
const pending = new Map(files.filter((f) => HASHED.has(extname(f)) && !KEEP.has(basename(f)) && !f.startsWith(join(DIST, "sounds")))
  .map((f) => [basename(f), f]));
const texts = () => walk(DIST).filter((f) => TEXT.has(extname(f)));
// a reference is the file name right after a path, a quote or a template expression
// ("./site.js", "fonts/x.woff2", `${base}x.woff2`), not a mention in prose or a comment
const refRe = (name) => new RegExp(`(?<=[/"'\`(}=])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`, "g");
const refers = (file, name) => refRe(name).test(readFileSync(file, "utf8"));
const renamed = {};
while (pending.size) {
  const ready = [...pending].filter(([name, f]) => ![...pending.keys()].some((other) => other !== name && TEXT.has(extname(f)) && refers(f, other)));
  if (!ready.length) throw new Error(`circular references between ${[...pending.keys()].join(", ")}`);
  for (const [name, f] of ready) {
    const ext = extname(name);
    const hashedName = `${name.slice(0, -ext.length)}.${hash(readFileSync(f))}${ext}`;
    const to = join(dirname(f), hashedName);
    renameSync(f, to);
    pending.delete(name);
    renamed[name] = hashedName;
    // rewrite "name" -> "name.<hash>" wherever it is referenced
    const re = refRe(name);
    for (const t of texts()) {
      const s = readFileSync(t, "utf8");
      const out = s.replace(re, hashedName);
      if (out !== s) writeFileSync(t, out);
    }
  }
}
// the service worker precaches the page's files (not the sounds) under a version made of their names
const shell = ["./", ...walk(DIST).map((f) => relative(DIST, f).split("\\").join("/"))
  .filter((f) => !f.startsWith("sounds/") && f !== "sw.js" && !f.endsWith(".txt") && f !== "og-image.png")];
const swPath = join(DIST, "sw.js");
writeFileSync(swPath, readFileSync(swPath, "utf8").replace("__VERSION__", hash(shell.join("\n") + readFileSync(join(DIST, "index.html"))))
  .replace("__SHELL__", JSON.stringify(shell)));
for (const [a, b] of Object.entries(renamed)) console.log(`${a} -> ${b}`);
console.log(`dist/ ready: ${walk(DIST).length} files, ${relative(ROOT, DIST)}`);
