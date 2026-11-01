# Guide administrateur / direction

## Première connexion
Connectez-vous avec le compte créé par `npm run create-admin` (ou `admin@ecole.demo` en démonstration). Le menu de gauche donne accès à tous les modules.

## Démarrer une année scolaire
1. **Utilisateurs** : créez les enseignants, parents, élèves et le secrétariat (bouton « + Ajouter »). Pour un parent, utilisez « Rattacher un élève » avec le numéro de l'élève. Pour relier un compte élève à son dossier, utilisez l'API `PUT /api/eleves/:id/compte` (Swagger) ou le seed.
2. **Classes** (niveau, section, capacité, titulaire), **Matières** (coefficient, niveau), **Salles**.
3. **Affectations** : indiquez quel enseignant enseigne quelle matière dans quelle classe (nécessaire pour qu'il saisisse notes et devoirs).
4. **Emploi du temps** : ajoutez les créneaux. Un conflit d'enseignant, de salle ou de classe est refusé avec un message clair.
5. **Grille tarifaire** : saisissez les tarifs par niveau (montants en millimes : 100000 = 100,000 TND), puis « Appliquer aux élèves » pour générer les frais. L'opération est sans doublon.

## Le menu
Le menu est classé par thèmes : 👥 Personnes (**Utilisateurs en premier**), 🏫 École, 📊 Pédagogie, 💰 Finances, ✉️ Communication, 🛡️ Contrôle. Le logo ou « 🏠 Accueil » ramène au tableau de bord.

## Thème des matières
Dans « Matières », choisissez une **couleur** et un **pictogramme** pour chaque matière (valeurs par défaut selon le nom : arabe, français, mathématiques…). Ils apparaissent dans l'emploi du temps, les devoirs, le bulletin en ligne et le bulletin PDF.

## Règles de cohérence appliquées automatiquement
Une matière ne peut être utilisée que dans une classe de son niveau (ou « Tous les niveaux ») · une évaluation, un créneau et une classe doivent être de la même année · une note ne peut être saisie que pour un élève de la classe · un enseignant doit être titulaire ou affecté · salle indisponible ou trop petite refusée · cours entre 07:30 et 18:00, 3 h maximum · date d'absence non future, sans doublon · devoir avec date de remise future · capacité d'une classe non inférieure à son effectif · les frais ne peuvent pas passer sous les paiements déjà reçus · un paiement ne peut pas dépasser le solde · un parent doit être un compte « parent ».

## Étoiles et reçus
- **⭐ Étoiles** : les enseignants (et vous) félicitent un élève ; le parent et l'élève sont prévenus ; le nombre d'étoiles figure sur le bulletin.
- **Reçus** : PDF illustrés avec montant en lettres, situation financière, tampon (« PAYÉ EN TOTALITÉ » ou « ACOMPTE REÇU ») et **QR code de vérification**. Si un paiement est modifié, l'ancien reçu devient invalide.

## Paiement en ligne des parents
Version de démonstration : le parent « paie » sur un écran simulé, sans argent réel. **Il est désactivé par défaut sur un vrai site** (variable `PAIEMENT_EN_LIGNE`). Un vrai paiement demande un compte marchand chez un prestataire (ex. Konnect, Paymee, Flouci, ClicToPay) et un raccordement technique, non inclus ici.

## Années scolaires
Page « Années scolaires » : créez l'année suivante (AAAA-AAAA), créez ses classes, puis cliquez sur « Activer ». Les paiements, bulletins et moyennes se calculent **par année** ; les bulletins des années passées restent consultables (sélecteur « Année »). Un élève garde sa classe actuelle : réaffectez-le à la rentrée (Modifier ou « Affecter auto »).

## Inscriptions
- **Pré-inscriptions** : validez ou refusez les demandes reçues depuis la page d'accueil. Une demande validée crée le dossier élève.
- **Élèves** : ajout, modification, photo, antécédents médicaux. « Affecter auto » place l'élève selon son âge au 1er septembre (6 ans = 1re année) dans une classe ayant une place. Import et export CSV disponibles.
- **Anonymiser** applique le droit à l'effacement (irréversible).

## Comptes, mots de passe et e-mails
- **Les mots de passe ne sont jamais lisibles** (ils sont stockés chiffrés) : personne, pas même l'administrateur, ne peut les retrouver.
- **Valider une pré-inscription** crée le dossier de l'élève **et le compte du parent** (e-mail saisi dans le formulaire). Un **mot de passe temporaire** s'affiche **une seule fois** à l'écran : notez-le et transmettez-le au parent. S'il a déjà un compte, l'élève est simplement rattaché à ce compte.
- Pour une pré-inscription déjà validée sans compte, utilisez « Créer le compte parent » dans la liste.
- **Mot de passe oublié :** « Utilisateurs », puis « Nouveau mot de passe » : un nouveau mot de passe temporaire s'affiche une seule fois.
- Un mot de passe temporaire déclenche un bandeau rouge jusqu'à ce que l'utilisateur le change (« Mon profil »).
- **E-mails :** si l'envoi est configuré (voir docs/deploiement_render.md), les identifiants sont aussi envoyés par e-mail ; le statut est visible dans « Journal ». Sinon, transmettez-les vous-même.

## Suivi
- **Absences** : validez les justifications des parents.
- **Impayés** : consultez la liste et envoyez les relances.
- **Annonces** : publication définitive (non modifiable). En cas d'erreur, publiez une annonce corrective.
- **Journal** : modifications des données, envois de messages de paiement, accès à l'historique des messages.

## Mot de passe
Chaque utilisateur peut changer son mot de passe (lien « Mon profil »). En cas d'oubli, l'administrateur définit un nouveau mot de passe depuis « Utilisateurs, Modifier ».

## Règles à connaître
La suppression est refusée si l'élément est encore utilisé (classe avec élèves, matière avec évaluations, enseignant encore affecté). Un message envoyé ou une annonce ne peut ni être modifié ni supprimé.
