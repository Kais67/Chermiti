# Mettre l'application en ligne gratuitement (Render)

## Pourquoi pas Netlify ?
Netlify héberge des sites statiques et des fonctions sans état : il ne peut pas faire tourner un serveur Express avec un fichier SQLite modifiable. Render exécute un vrai serveur Node, avec HTTPS automatique, sans carte bancaire.

## Limites du gratuit (à expliquer à votre professeur)
- **Le disque est éphémère :** la base SQLite est perdue à chaque redémarrage, réveil ou redéploiement. L'application recrée alors automatiquement les **données de démonstration fictives** (variable `ALLOW_DEMO_SEED=true`). Ce qui est saisi pendant la démonstration disparaît après une période d'inactivité.
- **Mise en veille après 15 minutes sans visite ;** le réveil prend jusqu'à environ une minute. Ouvrez le lien avant l'entretien.
- Les fichiers téléversés (photos, devoirs) disparaissent aussi.
- Pour une vraie école, il faut un disque persistant (offre payante Render avec disque, ou un VPS).

## Étapes
1. Créez un compte sur https://github.com et un dépôt **privé**. Poussez le projet (le fichier `.gitignore` exclut `.env`, la base et `node_modules`).
2. Créez un compte sur https://render.com (connexion avec GitHub).
3. **New → Blueprint**, choisissez le dépôt. Render lit `render.yaml`.
4. Saisissez `DEMO_PASSWORD` : un mot de passe de votre choix (8 caractères minimum) pour les comptes de démonstration. **Ne gardez pas `Demo2026!`** : le lien est public.
5. Cliquez sur **Apply**. Le premier déploiement dure quelques minutes.
6. Votre lien est de la forme `https://ecole-abou-el-kacem-chebbi.onrender.com`.
7. Envoyez au professeur le lien, les e-mails des comptes (`admin@ecole.demo`, `prof@ecole.demo`, `parent@ecole.demo`, `eleve@ecole.demo`, `compta@ecole.demo`) et le mot de passe choisi.

## Paiement en ligne sur Render
Sur Render gratuit (mode démonstration, `ALLOW_DEMO_SEED=true`), le paiement en ligne est une **simulation** : les parents voient un écran d'essai, aucun argent n'est débité. Pour un vrai site d'école, retirez `ALLOW_DEMO_SEED` : la simulation est alors désactivée par défaut.

## Envoyer des e-mails depuis Render gratuit
Render **bloque le SMTP** (ports 25, 465, 587) sur les services gratuits : seule une API web fonctionne. L'application sait utiliser l'API de Brevo :
1. Créez un compte gratuit sur https://www.brevo.com et validez une adresse expéditeur (Senders).
2. Créez une clé API (menu SMTP & API, clés API).
3. Dans Render, service, **Environment**, ajoutez : `BREVO_API_KEY` (la clé), `MAIL_FROM` (l'adresse expéditeur validée) et `PUBLIC_URL` (l'adresse de votre site, sans / final).
4. Enregistrez, attendez le redéploiement, puis testez dans l'application : **Journal, Tester l'envoi d'e-mails**.
Sans cette configuration, aucun e-mail n'est envoyé : l'administrateur transmet lui-même les mots de passe temporaires affichés à l'écran.

## Alternative : votre PC + tunnel Cloudflare (données conservées)
`npm run build`, `npm start`, puis `cloudflared tunnel --url http://localhost:3000`. Le lien HTTPS est temporaire et votre PC doit rester allumé.

## Passer en production réelle
Disque persistant, `ALLOW_DEMO_SEED` supprimé, premier administrateur créé avec `npm run create-admin`, sauvegardes quotidiennes (`npm run backup`).
