# École Abou El Kacem Chebbi : gestion d'école primaire

Application web mono-école : React + Vite (interface), Node.js + Express (API), **SQLite** (`better-sqlite3`).

## Installation (Windows, macOS, Linux)
Prérequis : **Node.js 22 ou plus récent** (exigé par better-sqlite3 v13), npm, Git facultatif.
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
`npm test` · Swagger : http://localhost:3000/api/docs

## Données, sauvegarde, restauration
- Base : `server/data/school.db` (créée automatiquement, jamais effacée au démarrage). Fichiers téléversés : `server/uploads/`.
- Sauvegarde : `npm run backup` → `server/data/backups/` (suppression après 30 jours). À planifier chaque jour (Planificateur de tâches Windows ou cron).
- Restauration : arrêter le serveur, puis `npm run restore --prefix server -- data/backups/school-XXXX.db`.

## Déploiement
SQLite = **une seule instance** en écriture et un **disque persistant**. Hébergements compatibles : VPS, ou Railway/Render/Fly avec volume monté (sinon la base est perdue à chaque redéploiement). Démonstration rapide : `cloudflared tunnel --url http://localhost:3000` (URL HTTPS temporaire, PC allumé). Docker : `docker build -t ecole .` puis `docker run -p 3000:3000 -v ecole-data:/data -e JWT_SECRET=... ecole` (pensez à sauvegarder aussi `server/uploads`). HTTPS : fourni par l'hébergeur ou un reverse proxy (Nginx + Let's Encrypt).

Voir `docs/` pour l'analyse du cahier des charges, les hypothèses et les limites.
