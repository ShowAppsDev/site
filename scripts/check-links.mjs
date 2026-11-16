// Vérifie les liens internes du site construit : chaque href/src commençant par « / » ou relatif
// doit pointer vers un fichier de dist/, et chaque ancre #id vers un id présent dans la page cible.
// Usage : node scripts/check-links.mjs dist
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, posix, sep } from 'node:path';

const root = process.argv[2] ?? 'dist';
if (!existsSync(root)) {
  console.error(`Dossier ${root} introuvable : lancer « npm run build » d'abord.`);
  process.exit(2);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const htmlFiles = walk(root).filter((f) => f.endsWith('.html'));
const idsCache = new Map();

function ids(file) {
  if (!idsCache.has(file)) {
    const html = readFileSync(file, 'utf8');
    idsCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idsCache.get(file);
}

function resolveTarget(urlPath) {
  const p = join(root, decodeURIComponent(urlPath));
  if (existsSync(p) && statSync(p).isFile()) return p;
  for (const candidate of [join(p, 'index.html'), `${p}.html`]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const errors = [];
let checked = 0;
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const pageUrl = '/' + relative(root, file).split(sep).join('/');
  for (const [, attr, raw] of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
    const value = raw.replace(/&amp;/g, '&');
    if (/^(https?:|mailto:|tel:|data:)/i.test(value) || value.startsWith('//')) continue;
    checked++;
    const [pathPart, hash] = value.split('#');
    const cleanPath = pathPart.split('?')[0];
    let target = file;
    if (cleanPath) {
      const abs = cleanPath.startsWith('/') ? cleanPath : posix.join(posix.dirname(pageUrl), cleanPath);
      target = resolveTarget(abs);
      if (!target) {
        errors.push(`${pageUrl} : ${attr}="${value}" ne mène à aucun fichier`);
        continue;
      }
    }
    if (hash && target.endsWith('.html') && !ids(target).has(hash)) {
      errors.push(`${pageUrl} : ancre « #${hash} » absente de ${relative(root, target)}`);
    }
  }
}

if (errors.length) {
  console.error(`${errors.length} lien(s) interne(s) cassé(s) :`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`${checked} liens internes vérifiés dans ${htmlFiles.length} pages : aucun lien cassé.`);
