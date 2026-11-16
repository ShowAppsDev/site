// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://showapp.fr',
  // /showapp -> dist/showapp/index.html ; nginx sert les dossiers avec try_files $uri $uri/.
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  // Aucune télémétrie ni script tiers dans le site produit.
  devToolbar: { enabled: false },
});
