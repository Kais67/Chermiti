# Paiements

## Règle d'or
**Un paiement simulé n'est jamais présenté comme réel.** Les modes DÉMO et *sandbox* n'encaissent aucun argent : leurs paiements sont enregistrés avec `simule=1`, affichés « TEST » (liste, reçu, messages), et le reçu PDF porte le filigrane « PAIEMENT DE TEST — AUCUN ARGENT RÉEL ». En production réelle la DÉMO est désactivée.

## Moyens de paiement
| Moyen | Statut | Fonctionnement |
|---|---|---|
| **Espèces + validation du secrétariat** | opérationnel | Le parent fait une *demande* (référence `ESP-XXXXXXXX`, valable 15 jours). **Aucun paiement n'existe** tant que le secrétariat (rôles admin ou comptable) n'a pas cliqué *Valider* après avoir reçu l'argent (montant réellement reçu saisi). Refus possible avec motif ; double validation impossible. L'enregistrement direct au guichet existait déjà et reste disponible. |
| **DÉMO** | opérationnel (dev/démo) | Page de simulation (réussite / échec / annulation). |
| **Flouci** | prêt, **non testé en réel** | API v2 (`generate_payment`, `verify_payment`), redirection + webhook. |
| **Konnect** | prêt, **non testé en réel** | API v2 (`init-payment`, `payments/{ref}`), redirection + webhook. |
Les connecteurs sont écrits d'après la documentation publique et validés contre de **faux serveurs** ; la validation finale se fait en *sandbox* avec vos clés.

## Brancher Flouci / Konnect (quand vous aurez un compte marchand)
1. Connectez-vous en administrateur de l'école → **Paiements en ligne**.
2. Saisissez les clés (Flouci : clé publique + privée ; Konnect : clé API + identifiant du portefeuille), environnement **Test (sandbox)**, cochez *Activer*.
3. Copiez l'adresse de notification (webhook) affichée dans le tableau de bord du prestataire.
4. Faites un paiement d'essai : il apparaît « TEST ».
5. Passez en **Réel** (exige `PUBLIC_URL` en HTTPS). Seuls les paiements réels ne sont plus marqués TEST.
Sécurité : le serveur **ne croit jamais le navigateur** : il interroge lui-même le prestataire (retour de redirection ou webhook), compare le montant, et n'enregistre qu'une fois (idempotent). Les clés sont chiffrées et jamais réaffichées.

## Ajouter un fournisseur
Créer un objet `{id,label,champs,pret,creer,verifier}` dans `server/src/services/paiement/fournisseurs.js` et l'ajouter à `tous` ; autoriser son identifiant dans les contraintes `config_paiement` (nouvelle migration).
