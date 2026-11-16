# Site showapp.fr

Vitrine publique de [ShowApp](https://showapp.fr), la marque qui regroupe les logiciels ShowApp et
StackSheets. Site statique construit avec [Astro](https://astro.build), en français, sans cookie, sans
mesure d'audience et sans script côté navigateur.

L'application ShowApp elle-même est servie sur [app.showapp.fr](https://app.showapp.fr) (dépôt
`ShowAppsDev/showapp`).

## Contenu

| Page | Fichiers |
|---|---|
| `/` | `src/pages/index.astro`, `src/content/accueil.md`, `src/content/accueil-suite.md` |
| `/showapp` | `src/pages/showapp.astro`, `src/content/showapp.md` |
| `/stacksheets` | `src/pages/stacksheets.astro`, `src/content/stacksheets.md`, `src/content/stacksheets-install.md` |
| `/support` | `src/pages/support.astro`, `src/content/support.md` |
| `/mentions-legales` | `src/pages/mentions-legales.astro`, `src/content/mentions-legales.md` |
| `/confidentialite` | `src/pages/confidentialite.astro`, `src/content/confidentialite.md` |

Les textes sont en Markdown dans `src/content/` ; les pages `.astro` ne portent que la structure
(titres, boutons, téléchargements). Mise en page commune et pied de page : `src/layouts/Base.astro` ;
styles : `src/styles/global.css` (clair et sombre selon le système).

Les marqueurs `<span class="todo">À COMPLÉTER</span>` (surlignés en jaune sur le site) signalent les
informations qui restent à fournir, dans `src/content/mentions-legales.md`. Pour les retrouver :

```bash
grep -rn "À COMPLÉTER" src
```

### Téléchargements

Les liens sont lus **au moment du build** (`src/lib/downloads.js`), jamais depuis le navigateur des
visiteurs :

- **StackSheets** : dernière release de
  [JulienConan/StackSheets-releases](https://github.com/JulienConan/StackSheets-releases/releases/latest)
  (API GitHub) ;
- **ShowApp (Windows)** : installateur annoncé par l'API publique de l'application,
  `https://app.showapp.fr/api/v1/desktop/update/` (puis `https://showapp.fr/…` tant que la bascule
  n'est pas faite).

Si l'API ne répond pas, le build réussit quand même et la page renvoie vers la page des releases ou
vers l'application. **Après une nouvelle version de StackSheets ou de ShowApp, relancer
`./deploy_site.sh`** pour mettre les liens à jour.

## Développement local

Prérequis : Node.js 22.23 ou plus récent.

```bash
npm install
```

```bash
npm run dev
```

Le site est alors sur <http://localhost:4321>.

## Build

```bash
npm run build
```

```bash
npm run check-links
```

Le site est produit dans `dist/` (une page = un dossier avec `index.html`, plus `404.html`).
`check-links` vérifie que chaque lien interne et chaque ancre de `dist/` mène quelque part ;
`npm run preview` sert `dist/` en local.

La CI GitHub Actions (`.github/workflows/ci.yml`) fait le build et la vérification des liens à chaque
push et pull request.

## Déploiement

```bash
./deploy_site.sh
```

Le script (à lancer depuis Git Bash ou un terminal Unix) :

1. construit le site et vérifie les liens ;
2. l'envoie sur le VPS dans `/opt/showapp2/site.new` (alias SSH `showapp-vps`, le même que
   `deploy_vps.sh` de ShowApp ; rsync s'il est installé, sinon tar par ssh) ;
3. remplace `/opt/showapp2/site` d'un coup ; la version précédente reste dans `/opt/showapp2/site.old` ;
4. redémarre le conteneur qui monte `/opt/showapp2/site` (le nginx de ShowApp) : un montage Docker
   suit le dossier d'origine et servirait sinon l'ancienne version. Cela coupe nginx quelques
   secondes, application comprise.

Côté serveur, le nginx de ShowApp (dépôt `ShowAppsDev/showapp`) sert `/opt/showapp2/site` sur
`showapp.fr`, avec `try_files $uri $uri/ $uri.html =404;` et `error_page 404 /404.html;`.

### Revenir en arrière

Sur le VPS :

```bash
cd /opt/showapp2 && mv site site.bad && mv site.old site && rm -rf site.bad
```

puis redémarrer le conteneur nginx (`docker compose restart nginx` dans le dossier de ShowApp).

## Licence des logiciels

Les logiciels ShowApp et StackSheets sont distribués sous licence
[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/).
