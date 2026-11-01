# Analyse du cahier des charges (Dr Hamdi Hassen, ISG Sousse, 20/10/2026)

## Périmètre : application mono-école, 5 rôles (Direction, Enseignant, Parent, Élève, Comptable/Secrétariat), RBAC contrôlé côté serveur.

## Règles implémentées
| Règle du PDF | Réalisation |
|---|---|
| CRUD sur toutes les entités + journal des modifications | Routes CRUD, table `audit_log` (utilisateur, date, anciennes/nouvelles valeurs) |
| Suppression contrôlée / logique | `deleted_at` ; refus 409 si l'entité est référencée (classe avec élèves, matière avec évaluations/créneaux, salle utilisée) |
| `annee_scolaire` sur les tables métier | Présente sur classes, élèves, évaluations, notes, frais, paiements, devoirs, absences, créneaux |
| Pré-inscription publique validée par l'administration | `/api/public/preinscriptions`, validation → création de l'élève |
| Capacité des classes | Refus 409 si la classe est complète |
| Import/export CSV | Export CSV, import CSV (nom, prénom, date_naissance, année). *Excel : non fait (CSV ouvrable dans Excel)* |
| Détection des conflits d'emploi du temps | Enseignant, salle **et classe** (requête serveur, 409) |
| Moyennes pondérées, bulletin PDF | `moyennes` + `/bulletin/:t` (pdfkit) |
| Absences + justification parent | Saisie enseignant, justification parent, validation Direction |
| Paiements : solde, reçu PDF, message au parent, journalisation | Une seule transaction (paiement, solde, message, notification, audit) |
| Devoirs : dépôt, correction, notes, « vu » parent | Complet, statuts rendu / en retard / non rendu / noté |
| Messages immuables, brouillons, masquage côté destinataire | Triggers SQL + règles API |
| Annonces immuables, ciblées par rôle | Triggers SQL |
| Journalisation des accès à l'historique | Table `acces_messages` |
| RGPD : consentement, portabilité, effacement | Case obligatoire, export JSON d'un élève, anonymisation |

## Hypothèses retenues (absentes du PDF)
- Moyenne d'une matière = moyenne des notes du trimestre ramenées sur 20 ; moyenne générale = Σ(moyenne × coefficient) / Σ coefficients.
- Montants en **millimes** (entiers) ; devise TND ; dates en ISO 8601.
- Un enseignant gère une classe/matière s'il en est titulaire ou s'il a un créneau correspondant.
- Un dépôt fait après la date de remise est accepté, marqué « en retard », et ne peut plus être remplacé.
- Un parent n'écrit qu'aux enseignants de ses enfants et à l'administration ; un élève n'écrit qu'à l'administration.

## Écarts volontaires avec le PDF
PostgreSQL → **SQLite** ; S3 → dossier `server/uploads` ; Firebase/SendGrid → notifications internes + e-mail SMTP **optionnel** (nodemailer, activé si `SMTP_HOST` est défini) ; push PWA non implémenté (PWA installable + cache hors-ligne minimal).

## Corrections apportées après vérification
Modification des utilisateurs et des paiements (soldes recalculés) ; lien de reçu cliquable dans le message ; contrôle de capacité à la modification d'un élève ; affectation automatique par âge ; antécédents médicaux, photo, coordonnées des parents ; grille tarifaire par niveau et année ; affectations enseignant ↔ matière ↔ classe ; type d'évaluation ; dépôts multi-fichiers ; pièces jointes des messages ; vue jour de l'emploi du temps ; journal d'envoi ; suppression d'un enseignant refusée s'il est encore affecté ; guides utilisateurs dans `docs/`.

## Audit avant mise en ligne (corrections)
Périmètre de l'enseignant limité à ses classes/matières (élèves, évaluations, notes, absences, devoirs) ; données médicales masquées au secrétariat ; refus des paiements supérieurs au solde ; année d'un paiement imposée par le serveur ; moyennes et bulletins **par année scolaire** ; salle indisponible refusée ; e-mail insensible à la casse ; changement de mot de passe ; écran des années scolaires ; fil de discussion par élève et « Répondre » ; suppression de note dans l'interface ; relances automatiques (option RELANCES_AUTO) ; e-mails optionnels pour annonces et messages ; limite anti-spam sur la pré-inscription publique ; messages de validation en français ; erreurs 500 journalisées ; fichier trop volumineux → message clair ; images blob autorisées (photos) ; icônes PNG de la PWA.

## Évolutions : menu, logique, paiement en ligne, design
Menu regroupé par thèmes (Utilisateurs en premier pour la Direction) ; une vingtaine de règles de cohérence ajoutées (voir guide administrateur) ; **paiement en ligne parent avec reçu** (passerelle simulée : un prestataire réel exige un compte marchand) ; thèmes couleur et pictogramme par matière ; **bulletin et reçu PDF redessinés** (pictogrammes vectoriels, moyenne de la classe, appréciations en étoiles, montant en lettres, tampon, QR code de vérification publique) ; étoiles de félicitations ; page d'aide à symboles et interface à grosses tuiles pour les parents peu à l'aise avec la lecture.

## Limites connues
Paiement en ligne : simulation uniquement (aucun prestataire réel branché) ; interface en français seulement (une version arabe aiderait beaucoup de parents) ; les pictogrammes du PDF sont dessinés (les emojis ne s'impriment pas) ; Pas de push PWA ; pas d'import Excel (CSV uniquement) ; relances d'impayés par bouton (pas de planification automatique) ; pas de tranches de paiement échelonnées ; pas de pagination côté serveur ; interface non testée automatiquement ; performance (500 utilisateurs) et accessibilité WCAG non auditées ; jeton de connexion stocké en `localStorage` ; l'e-mail n'a pas pu être testé sans serveur SMTP réel ; la liaison compte élève ↔ dossier se fait par l'API ou le seed (pas d'écran dédié) ; la classe d'un élève n'est pas historisée d'une année à l'autre (les notes et moyennes le sont) ; pas de « mot de passe oublié » en libre-service (réinitialisation par l'administrateur)
