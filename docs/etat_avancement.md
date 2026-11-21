# État d'avancement — évolution Multi-Écoles (branche `evolution-multi-ecoles`)

Dernière mise à jour : 18/11/2026. Sauvegarde de l'état précédent : étiquette Git `sauvegarde-avant-evolution`.

## Terminé et testé
| Chantier | Ce qui existe | Vérification |
|---|---|---|
| **PostgreSQL** | Adaptateur de base asynchrone (SQLite pour tests/démo, **PostgreSQL pour la production**), migrations PG équivalentes (001→007), triggers PL/pgSQL, verrou de migration | 19 tests passent sur PostgreSQL 16 réel, 18 sur SQLite |
| **PlatformDB + une base par école** | Registre central `ecoles` (URL de base chiffrées AES-256-GCM), création d'école = `CREATE DATABASE` + migrations + premier administrateur, jetons liés à l'école (un jeton de l'école A est refusé par l'école B), suspension, console `/plateforme` | test d'isolation sur SQLite **et** PostgreSQL ; test de production réelle (voir ci-dessous) |
| **Migration sécurisée** | `npm run migrer:sqlite-vers-pg` : sauvegarde horodatée + SHA-256, travail sur une copie, cible obligatoirement vide, une seule transaction, contrôle des comptages et des totaux financiers, mode `--simulation`, séquences recalées | test automatisé (copie complète, refus si cible non vide, source strictement inchangée) |
| **Sauvegarde / restauration** | `npm run backup` (PlatformDB + chaque école, SQLite ou `pg_dump`), `restore` avec sauvegarde de sécurité préalable | testé en SQLite et PostgreSQL (1 → 2 → restauration → 1) |
| **Paiements** | Interface commune de fournisseurs : **DÉMO**, **Flouci**, **Konnect** (clés par école, chiffrées). Tout paiement DÉMO ou *sandbox* est enregistré `simule=1`, marqué « TEST » partout, reçu PDF filigrané. Vérification **côté serveur** auprès du fournisseur, webhooks idempotents, contrôle du montant. **Espèces** : le parent fait une demande, le secrétariat (admin/comptable) valide après réception de l'argent | 4 tests dédiés (faux serveurs Flouci/Konnect, rejeu, montant incohérent, expiration, rôles) |
| **Langues** | Français (défaut), **arabe RTL**, anglais ; catalogue unique par langue, 517 textes + libellés dynamiques traduits à 100 %, messages d'erreur du serveur traduits, sélecteur de langue, langue par défaut par école | 4 tests du moteur ; `npm run i18n:verifier` (échoue si une traduction manque) |
| **Android** | Projet Capacitor (`client/android`), icônes et écrans de démarrage générés, signature release par variables d'environnement, CORS serveur, workflow GitHub Actions produisant **APK de test** et **AAB** | ⚠️ **non compilé ici** : le SDK Android n'est pas téléchargeable depuis cet environnement (voir `docs/android.md`) |
| **Démonstration** | `render.yaml` **inchangé** : la démo gratuite continue de fonctionner (école existante enregistrée automatiquement dans PlatformDB, aucun changement d'URL ni de comptes) | test de bout en bout en mode démo |
| **Production** | `render.production.yaml` (non appliqué) ; test complet `NODE_ENV=production` + PostgreSQL : création d'école à chaud, isolation, DÉMO refusée, CORS mobile, client servi | exécuté |

Aucun bouton sans action (audit statique : 82 boutons, 0 sans gestionnaire). Aucune fonctionnalité existante supprimée : les 13 tests d'origine passent toujours.

## Ajouts liés au cahier des charges « Cloud et Big Data » (novembre 2026)
* **Rôle Directeur** (distinct de l'Administrateur), **2 écoles de démonstration × 6 profils** (`docs/demo_comptes.md`), fichier Word des identifiants (`Identifiants_comptes_demo.docx`).
* **Module BI** : 9 tableaux de bord (`/api/bi/*`, page « Tableaux de bord »), indicateurs vérifiés contre la base par les tests.
* **Isolation entre écoles** testée dans les deux sens (`docs/isolation_entre_ecoles.md`).
* Renseigner l'URL publique dans le fichier Word avant remise (date limite : 30/11/2026).

## SaaS, hébergement Google Cloud et boutiques (novembre 2026)
* **Back-office SaaS** (`/plateforme`) : créer, **modifier**, suspendre/réactiver des écoles ; **plan** (essai/standard/premium), **date de fin d'abonnement** (accès bloqué à l'expiration, rétabli à la prolongation), contact, statistiques, **mot de passe administrateur oublié**, ouverture de l'école. Testé sur SQLite et PostgreSQL.
* **Google Cloud** : `deploy/gcp/deploy.sh` + `docs/hebergement_google_cloud.md` (Cloud Run HTTPS, Cloud SQL, Cloud Storage, Secret Manager). ⚠ Non exécuté sur un vrai projet ; coûts à votre charge (confirmation « OUI » exigée par le script).
* **iOS** : projet `client/ios` + workflow GitHub `ios.yml` (compilation simulateur ; IPA signé avec compte Apple Developer). ⚠ Non testé sur un vrai compte Apple. Voir `docs/publication_stores.md` (dont le risque de refus 4.2).

## Reste à faire (je peux le faire sans vous)
1. **Stockage des fichiers déposés** (photos, devoirs, pièces jointes) : ils sont sur le disque du serveur. En production, soit un disque persistant Render (payant), soit un stockage objet S3/R2 (code à écrire). Aujourd'hui : variable `UPLOADS_DIR`.
2. **PDF en arabe** (reçus, bulletins) : restent en français (la bibliothèque PDF ne gère pas l'écriture arabe cursive sans police + moteur de mise en forme dédiés).
3. **Test visuel du client** : le client compile et ses textes/RTL sont testés par code, mais je n'ai pas pu l'ouvrir dans un navigateur ici. Une relecture visuelle FR/AR/EN sur téléphone est à faire.
4. **Langue préférée par utilisateur** (aujourd'hui : mémorisée sur l'appareil + langue par défaut de l'école).
5. **Guides utilisateur** (`guide_*.md`) : à mettre à jour pour les nouveautés (demande d'espèces, console plateforme).

## Nécessite votre intervention (je prépare tout, rien n'est dépensé ni publié)
| Quand | Quoi | Coût indicatif* |
|---|---|---|
| **Passage en production réelle** | Souscrire Render **Postgres payant** (la base gratuite **expire après 30 jours** et n'a **aucune sauvegarde**) + **service web toujours actif** | ≈ 6 $/mois (Postgres basic-256mb) + ≈ 7 $/mois (web starter) + stockage |
| Production, fichiers déposés | Disque persistant Render **ou** compte stockage objet | payant / gratuit selon l'offre |
| Création des bases d'école | Vérifier que l'utilisateur Postgres de Render peut `CREATE DATABASE`. Sinon : une instance Postgres par école (+6 $/mois chacune) via le champ `database_url` | — |
| Paiements réels | Compte marchand **Flouci** et/ou **Konnect** → saisir les clés dans *Paiements en ligne* (d'abord en *sandbox*) | selon contrat prestataire |
| Android | 1) variable de dépôt `API_URL` (https) 2) lancer le workflow *Android* 3) pour Google Play : compte développeur + clé d'envoi (secrets) | compte Google Play : frais uniques (à votre charge) |
| Avant publication | Nom définitif de l'application et de l'éditeur, identifiant d'application (`tn.chermiti.ecoles` est **temporaire**), politique de confidentialité | — |

\* Tarifs relevés sur render.com (juillet 2026) ; à revérifier au moment de souscrire.

**Nom de travail** : « Chermiti Écoles » (identifiant `tn.chermiti.ecoles`). Modifiable avant publication dans `client/capacitor.config.json` et `client/android/app/build.gradle`.
