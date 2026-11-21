# Publication sur Google Play et App Store

L'application mobile est la **même interface** que le site, embarquée dans une application native (Capacitor) ; elle appelle votre plateforme en HTTPS (`API_URL`) et demande le **code de l'école** au premier lancement.
Prérequis commun : la plateforme déjà en ligne en HTTPS (`docs/hebergement_google_cloud.md`).

| | Google Play | App Store (iOS) |
|---|---|---|
| Projet | `client/android` ✔ prêt | `client/ios` ✔ généré (icônes, écrans de démarrage) |
| Construction | GitHub Actions « **Android** » → APK de test + AAB | GitHub Actions « **iOS** » → compilation simulateur ; IPA signé si vous fournissez les secrets |
| Compte requis | Google Play Console (frais d'inscription uniques) | **Apple Developer Program (abonnement annuel)** |
| Signature | clé d'envoi (`keytool`, voir `docs/android.md`) | certificat de distribution + profil de provisionnement (créés sur developer.apple.com) |
| Test avant publication | piste *Test interne* | **TestFlight** |
Tarifs d'inscription : à vérifier sur les sites Google et Apple au moment de vous inscrire. **Rien n'est publié sans votre autorisation.**

## À préparer pour les deux boutiques
* **Nom définitif**, éditeur, **identifiant d'application** (`tn.chermiti.ecoles` est temporaire : *définitif dès la première publication*), icônes (générées depuis `client/public/logo.svg`), captures d'écran FR/AR/EN, descriptions.
* **Politique de confidentialité** publique (URL) : l'application traite des données d'**enfants** (RGPD, consentement parental). Déclarez la collecte (nom, e-mail, notes, absences, paiements) dans le formulaire « Sécurité des données » (Google) et « Confidentialité de l'app » (Apple). Ne **pas** viser la catégorie « Enfants » (exigences spécifiques) : l'application s'adresse aux parents, enseignants et administrations.
* **Compte de démonstration pour les relecteurs** : fournissez un code d'école et des identifiants de test (par ex. `ecole-a` + `parent.a@demo.tn`, `docs/demo_comptes.md`), sans quoi la validation est refusée.
* **Suppression de compte** : Apple (règle 5.1.1) et Google exigent d'expliquer comment supprimer son compte ; ici les comptes sont créés et supprimés par l'administrateur de l'école — indiquez-le dans la fiche et la politique de confidentialité.

## Point d'attention App Store
Apple peut refuser une application qui n'est qu'un site web dans un conteneur (règle 4.2 « fonctionnalités minimales »). Atouts : application métier avec compte, hors-ligne partiel (PWA), paiements, notifications. **Pour réduire le risque**, ajoutez avant soumission des fonctions réellement natives (notifications push, ouverture de fichiers/PDF, partage). C'est une évolution possible, non réalisée à ce jour.

## Marche à suivre iOS
1. Créez le compte Apple Developer ; créez l'identifiant d'app `tn.chermiti.ecoles` (ou le définitif) et la fiche dans **App Store Connect**.
2. Exportez le certificat de distribution (.p12) et téléchargez le profil « App Store » ; renseignez les secrets GitHub (en-tête de `.github/workflows/ios.yml`) et la variable `IOS_SIGNATURE=oui`.
3. Lancez le workflow **iOS** ; téléchargez l'IPA ; envoyez-le avec l'app **Transporter** (Mac) ou ajoutez une étape d'envoi.
4. Testez via TestFlight, puis soumettez à la revue.
