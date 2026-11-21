# École Abou El Kacem Chebbi : gestion d'école primaire

Plateforme **multi-écoles** : React + Vite (interface web FR/AR/EN, application Android via Capacitor), Node.js + Express (API), **PostgreSQL** en production (PlatformDB + une base par école) ; SQLite uniquement pour les tests locaux et la démonstration.

➡ État d'avancement, décisions à prendre et coûts : [`docs/etat_avancement.md`](docs/etat_avancement.md) · architecture : [`docs/architecture_multi_ecoles.md`](docs/architecture_multi_ecoles.md) · paiements : [`docs/paiements.md`](docs/paiements.md) · langues : [`docs/i18n.md`](docs/i18n.md) · Android : [`docs/android.md`](docs/android.md).

## Installation (Windows, macOS, Linux)
Prérequis : **Node.js 22 ou plus récent** (22 LTS ou 24), npm. Aucun outil de compilation n’est requis : si `better-sqlite3` (optionnel) ne s’installe pas, le projet utilise automatiquement le SQLite intégré à Node.
```
npm run install:all
copy .env.example .env          (Windows)   |   cp .env.example .env   (macOS/Linux)
```
Ouvrez `.env` et remplacez `JWT_SECRET` par une longue chaîne aléatoire.

## Démarrage
```
npm run seed        # données de démonstration fictives (une seule fois)
npm run dev         # API http://localhost:3000 + interface http://localhost:5173
```
Mode « production locale » (un seul serveur) : `npm run build` puis `npm start` → http://localhost:3000.

Comptes de démonstration (mot de passe `Demo2026!`) : `admin@ecole.demo`, `prof@ecole.demo`, `parent@ecole.demo`, `eleve@ecole.demo`, `compta@ecole.demo`.
Pour un usage réel : n'exécutez pas `seed`, créez le premier administrateur avec `npm run create-admin`.

## Tests, documentation API
`npm test` (SQLite) · avec PostgreSQL : `TEST_PG_URL=postgres://utilisateur:mdp@localhost:5432/postgres npm test --prefix server` · Swagger : http://localhost:3000/api/docs?ecole=<code>

## Données, sauvegarde, restauration
- Base : `server/data/school.db` (créée automatiquement, jamais effacée au démarrage). Fichiers téléversés : `server/uploads/`.
- Sauvegarde : `npm run backup` → `server/data/backups/` (suppression après 30 jours). À planifier chaque jour (Planificateur de tâches Windows ou cron).
- Restauration : arrêter le serveur, puis `npm run restore --prefix server -- data/backups/school-XXXX.db`.

## Déploiement
SQLite = **une seule instance** en écriture et un **disque persistant**. Hébergements compatibles : VPS, ou Railway/Render/Fly avec volume monté (sinon la base est perdue à chaque redéploiement). Démonstration rapide : `cloudflared tunnel --url http://localhost:3000` (URL HTTPS temporaire, PC allumé). Docker : `docker build -t ecole .` puis `docker run -p 3000:3000 -v ecole-data:/data -e JWT_SECRET=... ecole` (pensez à sauvegarder aussi `server/uploads`). HTTPS : fourni par l'hébergeur ou un reverse proxy (Nginx + Let's Encrypt).

Voir `docs/` pour l'analyse du cahier des charges, les hypothèses et les limites.
