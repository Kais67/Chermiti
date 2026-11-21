# Architecture multi-écoles

```
Navigateur / App Android ──► Serveur Node (un seul processus)
                               ├─ /api/plateforme/*  (super-administrateur) ─► PlatformDB
                               └─ /api/*  → répartiteur : choisit l'école ─► application de l'école ─► base DE L'ÉCOLE
```
* **PlatformDB** : registre `ecoles` (code, nom, statut, langue par défaut, URL de base **chiffrée**), `super_admins`, `audit_plateforme`. Aucune donnée scolaire.
* **Une base indépendante par école** (PostgreSQL : `ecole_<code>`), avec le schéma complet (`server/src/db/migrations/pg`). Rien n'est partagé entre écoles.
* **Choix de l'école** (dans l'ordre) : en-tête `X-Ecole` · sous-domaine (`BASE_DOMAIN`) · `?ecole=` · `DEFAULT_ECOLE_SLUG` · l'école unique s'il n'y en a qu'une.
  L'application mobile demande le **code de l'école** au premier lancement.
* **Jetons** : contiennent l'école ; refusés par toute autre école.
* **Écoles suspendues** : réponse 403 `ECOLE_SUSPENDUE`.

## Variables d'environnement
`PLATFORM_DATABASE_URL`, `PG_ADMIN_URL`, `TENANT_SECRET` (**à sauvegarder** : sans lui les URL chiffrées sont illisibles), `JWT_SECRET`, `SUPER_ADMIN_EMAIL/PASSWORD`, `UPLOADS_DIR`, `PUBLIC_URL`, `CORS_ORIGINS`, `BASE_DOMAIN`, `DEFAULT_ECOLE_SLUG`. Détail : `.env.example`.
Sans `PLATFORM_DATABASE_URL`, le serveur utilise SQLite (tests, démonstration) et l'indique par un avertissement en production.

## Opérations
| Action | Commande |
|---|---|
| Créer un super-administrateur | `SUPER_ADMIN_EMAIL=… SUPER_ADMIN_PASSWORD=… npm run superadmin:creer --prefix server` (ou variables au démarrage) |
| Créer une école | console `/plateforme` ou `npm run ecole:creer --prefix server -- --slug mon-ecole --nom "Mon École" --admin-email … --admin-password …` (option `--database-url` pour une base PostgreSQL séparée) |
| Appliquer les migrations à toutes les écoles | `npm run ecoles:migrer --prefix server` (à chaque déploiement) |
| Sauvegarder | `npm run backup --prefix server [-- --ecole code]` (PostgreSQL : nécessite `pg_dump`, version ≥ celle du serveur) |
| Restaurer | `node server/scripts/restore.js <code> <fichier>` (sauvegarde de sécurité automatique avant écrasement) |

## Migrer l'école existante (SQLite → PostgreSQL), sans risque
1. Créer une base PostgreSQL vide pour l'école.
2. **Simulation** : `npm run migrer:sqlite-vers-pg --prefix server -- --source server/data/school.db --cible postgres://… --simulation` (n'écrit rien, vérifie tout).
3. Migration réelle (même commande sans `--simulation`) : sauvegarde horodatée + SHA-256, copie dans **une transaction**, contrôle des comptages et des totaux de paiements/frais ; en cas d'écart, **rien** n'est écrit.
4. Bascule explicite : ajouter `--basculer <code-école>` (met à jour PlatformDB). L'ancienne base SQLite reste intacte : retour arrière = remettre `db_driver='sqlite'`.
5. Copier aussi le dossier `uploads/`.
Ne jamais modifier la production sans avoir vérifié la sauvegarde.

## Sécurité
Mots de passe en bcrypt ; clés de paiement et URL de bases chiffrées (AES-256-GCM) ; limitation des tentatives de connexion ; rôles contrôlés côté serveur ; audit des actions sensibles. Isolation renforcée possible (non activée) : un rôle PostgreSQL distinct par école.
