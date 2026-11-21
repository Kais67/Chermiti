# Comptes de démonstration (projet Cloud et Big Data)

Activés par `DEMO_ECOLES=true` (déjà dans `render.yaml`). Deux écoles **indépendantes** (une base de données chacune) sont créées au démarrage avec un jeu de données fictif : 12 classes, ~245 élèves, 14 enseignants, 2 années scolaires, notes, absences, paiements étalés, messages, emplois du temps.

| Profil | E-mail (école A / B) | Mot de passe A | Mot de passe B |
|---|---|---|---|
| Administrateur | admin.a@demo.tn / admin.b@demo.tn | DemoEcoleA#2026 | DemoEcoleB#2026 |
| Directeur | directeur.a@demo.tn / directeur.b@demo.tn | idem | idem |
| Enseignant | enseignant.a@demo.tn / enseignant.b@demo.tn | idem | idem |
| Comptable | comptable.a@demo.tn / comptable.b@demo.tn | idem | idem |
| Parent | parent.a@demo.tn / parent.b@demo.tn | idem | idem |
| Élève | eleve.a@demo.tn / eleve.b@demo.tn | idem | idem |

Codes d'école : `ecole-a`, `ecole-b`. Super-administrateur (console `/plateforme`) : `superadmin@demo.tn` / `SuperDemo#2026`.
**Ce sont des comptes de démonstration à mots de passe temporaires** : ne jamais réutiliser ce fichier `render.yaml` tel quel pour de vraies données (changer ou supprimer ces valeurs).

## Droits des profils
* **Administrateur** : tout, y compris la gestion des comptes et la configuration (paiements en ligne).
* **Directeur** : pilotage — BI, finances, pédagogie, absences, annonces, pré-inscriptions ; **pas** de gestion des comptes ni de configuration technique.
* **Enseignant** : ses classes/matières. **Comptable** : finances (+ BI financier). **Parent** : ses enfants. **Élève** : lui-même.

## Tableaux de bord BI (menu « Pilotage » → « Tableaux de bord »)
Neuf tableaux sur dix du cahier des charges : général, financier, pédagogique, absences, enseignants, communications, salles/emplois du temps, alertes précoces (Early Warning System, score expliqué), stratégique (prévision, **simulation de scénarios**, recommandations automatiques). L'API est `GET /api/bi/<tableau>?annee=AAAA-AAAA`.
Non réalisé : tableau « inscriptions et fidélisation » complet (réinscriptions, départs, origine géographique : données non saisies) — les nouvelles inscriptions par année et les effectifs facturés sont dans « Vue générale ». Les absences/remplacements des enseignants et les dépenses ne sont pas saisis dans l'application : le tableau l'indique explicitement.
Les messages générés par le serveur (alertes, recommandations, raisons) sont en français.
