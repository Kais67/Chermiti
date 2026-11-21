# Isolation entre écoles

Le guide « Isolation entre écoles » propose une colonne `school_id` + filtre automatique dans une base commune. Ce projet applique l'approche **la plus forte** : **une base de données séparée par école** (PlatformDB ne contient que le registre des écoles). Une requête ne peut donc physiquement pas lire une ligne d'une autre école, et il n'existe aucun `WHERE school_id` à oublier.

| Point du guide | Mise en œuvre | Test (`server/tests/demo.test.js`) |
|---|---|---|
| L'école vient de la connexion, jamais de la page | école + rôle dans le jeton signé ; jeton d'une école refusé par les autres | jetons des 6 profils A→B et B→A : 401 |
| Filtre en un seul endroit | répartiteur (`plateforme/index.js`) : choisit la base de l'école avant toute route | listes « A-Élève1 » / « B-Élève1 » |
| Liens avec un numéro (`/eleve/124`) | l'identifiant est cherché dans la base de l'école seulement | lignes existant dans une seule école → 404, dans les deux sens ; modification d'une ligne de l'autre école refusée |
| Fichiers | dossier de dépôt distinct par école (`uploads/<code>/`) | dossiers différents |
| Exports / reçus / bulletins | même base, même contrôle | reçu, bulletin et suppression d'un paiement de B avec un jeton de A : refusés, paiement intact |
| Recherche et statistiques | calculées sur la base de l'école | KPI BI = comptage de la base de l'école, différent entre A et B |
| Tâches de fond | `relances.lancer(db)` reçoit explicitement l'école | relances de A : 0 effet sur B |
| Doublons / noms d'utilisateur | unicité par base ; connexion = (école, e-mail) | même e-mail dans A et B, mots de passe différents |
| Cache | cache des écoles indexé par code d'école | — |
| Comptes | bcrypt, rôle par compte, super-administrateur séparé (`/plateforme`) | — |
| Parent / enseignant | parent : ses enfants ; enseignant : ses classes | matrice des droits (6 profils × 2 écoles) |
Les tests tournent sur SQLite et sur PostgreSQL réel : `npm test --prefix server` et `TEST_PG_URL=… npm test --prefix server`.
