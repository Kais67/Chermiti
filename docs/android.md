# Application Android (Capacitor)

Nom de travail : **Chermiti Écoles** — identifiant `tn.chermiti.ecoles` (**temporaires**, à finaliser avant publication). Le client web est embarqué dans l'application et parle au serveur de la plateforme (HTTPS). Au premier lancement l'utilisateur saisit le **code de son école**.

## Produire l'APK de test et l'AAB (gratuit, sur GitHub)
1. GitHub → *Settings → Secrets and variables → Actions → Variables* : `API_URL` = adresse HTTPS du serveur (ex. `https://multi-ecoles.onrender.com`).
2. Onglet *Actions* → **Android** → *Run workflow* (versionCode croissant). Résultat dans *Artifacts* :
   * `app-debug.apk` : à installer sur un téléphone pour tester.
   * `app-release.aab` : **non signé** tant que les secrets de signature ne sont pas fournis.
3. Pour un AAB signé (obligatoire pour Google Play) : créer une clé d'envoi
   `keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
   puis secrets du dépôt : `KEYSTORE_BASE64` (`base64 -w0 upload.jks`), `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`. **Conservez `upload.jks` et ses mots de passe hors du dépôt** (leur perte bloque les mises à jour).
En local (Android Studio + JDK 21) : `npm run build:android --prefix client` puis `npm run android:ouvrir --prefix client`.

> Ces builds n'ont **pas pu être exécutés dans l'environnement de développement** (SDK Android indisponible) : le premier lancement du workflow est le vrai test ; un échec éventuel se corrige rapidement.

## Publication Google Play (à faire à la fin, avec vous)
Inscription développeur (frais uniques), fiche (nom définitif, éditeur, descriptions FR/AR/EN, captures), politique de confidentialité (données d'enfants), questionnaire de sécurité des données, test interne puis production. **Rien n'est publié sans votre autorisation.**
