// Liens de téléchargement, lus au moment du build (aucun appel depuis le navigateur des visiteurs).
// En cas d'échec réseau, le site se construit quand même et renvoie vers la page des releases.

const STACKSHEETS_LATEST = 'https://github.com/JulienConan/StackSheets-releases/releases/latest';
const STACKSHEETS_API = 'https://api.github.com/repos/JulienConan/StackSheets-releases/releases/latest';

async function getJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'showapp-site-build' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`${url} : HTTP ${res.status}`);
  return res.json();
}

const PLATFORMS = [
  { key: 'windows', label: 'Windows', test: (n) => /\.exe$/i.test(n) },
  { key: 'macos', label: 'macOS', test: (n) => /\.dmg$/i.test(n) },
  { key: 'android', label: 'Android', test: (n) => /\.apk$/i.test(n) },
];

export async function stackSheetsRelease() {
  try {
    const data = await getJson(STACKSHEETS_API);
    const assets = data.assets ?? [];
    const files = PLATFORMS.map((p) => {
      const a = assets.find((x) => p.test(x.name));
      return a ? { ...p, name: a.name, url: a.browser_download_url, size: a.size } : null;
    }).filter(Boolean);
    const sums = assets.find((x) => x.name === 'SHA256SUMS.txt');
    return {
      version: String(data.tag_name ?? '').replace(/^v/, ''),
      files,
      sums: sums?.browser_download_url ?? null,
      page: data.html_url ?? STACKSHEETS_LATEST,
    };
  } catch (err) {
    console.warn(`[téléchargements] StackSheets : ${err.message}`);
    return { version: null, files: [], sums: null, page: STACKSHEETS_LATEST };
  }
}

// L'installateur Windows de ShowApp est annoncé par l'API publique de l'application.
// app.showapp.fr d'abord ; showapp.fr tant que la bascule n'est pas faite.
const SHOWAPP_HOSTS = ['https://app.showapp.fr', 'https://showapp.fr'];

export async function showAppInstaller() {
  for (const host of SHOWAPP_HOSTS) {
    try {
      const data = await getJson(`${host}/api/v1/desktop/update/`);
      if (data?.version && typeof data.url === 'string' && data.url.startsWith('/')) {
        return { version: data.version, url: `${host}${data.url}`, size: data.size ?? null };
      }
    } catch (err) {
      console.warn(`[téléchargements] ShowApp (${host}) : ${err.message}`);
    }
  }
  return null;
}

export function formatSize(bytes) {
  if (!bytes) return '';
  return `${(bytes / 1024 / 1024).toFixed(0)} Mo`;
}
