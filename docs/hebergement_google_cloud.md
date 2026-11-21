# Hébergement sur Google Cloud (HTTPS) — plateforme SaaS multi-écoles

## Architecture
```
Navigateurs / apps Android & iOS ──HTTPS──► Cloud Run (conteneur Node, certificat géré par Google)
                                              ├─► Cloud SQL PostgreSQL 16 : PlatformDB + une base par école (CREATE DATABASE)
                                              ├─► Cloud Storage (monté en /mnt/fichiers) : fichiers déposés, un dossier par école
                                              └─► Secret Manager : JWT_SECRET, TENANT_SECRET, URL de bases, mot de passe super-admin
```
Cloud SQL résout la question laissée ouverte sur Render : l'utilisateur `postgres` **peut créer une base par école**.

## Déployer (≈ 15 min, depuis Google Cloud Shell)
1. Créez un projet Google Cloud et **activez la facturation** (obligatoire pour Cloud SQL). *(Votre compte, votre carte : je ne peux pas le faire à votre place.)*
2. Ouvrez **Cloud Shell**, clonez votre dépôt, puis :
   ```
   export PROJECT_ID=votre-projet
   export SUPER_ADMIN_EMAIL=vous@exemple.com
   bash deploy/gcp/deploy.sh
   ```
   Le script demande de taper **OUI** avant de créer quoi que ce soit de payant, puis affiche l'URL HTTPS, l'adresse de la console `/plateforme` et le mot de passe temporaire du super-administrateur.
3. Ouvrez `https://…run.app/plateforme`, connectez-vous, **créez vos écoles** (code, nom, plan, date de fin d'abonnement, administrateur).
4. Pour Android/iOS : variable de dépôt GitHub `API_URL` = cette URL (voir `docs/publication_stores.md`).

## Domaine personnalisé
Cloud Run → *Gérer les domaines personnalisés* (certificat HTTPS géré). Avec `BASE_DOMAIN=ecoles.exemple.tn`, chaque école peut aussi avoir son sous-domaine `mon-ecole.ecoles.exemple.tn` (domaine joker à configurer au DNS).

## Coûts (à vérifier sur cloud.google.com/pricing avant d'activer)
* **Cloud Run** : offre gratuite mensuelle, puis à l'usage (`MIN_INSTANCES=0` : gratuit au repos, démarrage à froid de quelques secondes).
* **Cloud SQL** : **payant en continu**, sans offre gratuite permanente (la plus petite instance `db-f1-micro` suffit pour quelques écoles). C'est le poste principal.
* **Cloud Storage, Secret Manager, Cloud Build** : très faibles à cette échelle.
Surveillez *Facturation → Budgets et alertes* (créez une alerte de budget). Les crédits « étudiants » de Google Cloud peuvent couvrir un projet de cours.

## Sauvegardes et exploitation
* Cloud SQL : sauvegardes automatiques quotidiennes (activées par le script) + restauration à un instant donné selon l'offre.
* Mise à jour : `gcloud run deploy multi-ecoles --source . --region europe-west1` (les migrations de chaque école s'appliquent à sa première requête ; `npm run ecoles:migrer` pour forcer).
* **Sauvegardez `TENANT_SECRET` hors de Google Cloud** : sans lui, les URL de bases d'écoles stockées sont illisibles.
* Limite de connexions : `TENANT_POOL_MAX=2` et `TENANTS_CACHE=10` évitent de saturer Cloud SQL avec beaucoup d'écoles ; augmentez l'instance au-delà d'une vingtaine d'écoles actives.

## Ce qui n'a pas pu être vérifié ici
Le script et la connexion par socket Cloud SQL (`postgres://…@/base?host=/cloudsql/…`, testée au niveau code) **n'ont pas été exécutés sur un vrai projet Google Cloud** (pas d'accès à votre compte). Au premier lancement, copiez-moi les messages d'erreur éventuels.
