-- Reconstruction de paiements : nouveau mode « carte_en_ligne », canal et référence
CREATE TABLE paiements_new(id INTEGER PRIMARY KEY, eleve_id INTEGER NOT NULL REFERENCES eleves(id), montant_millimes INTEGER NOT NULL CHECK(montant_millimes>0),
 mode TEXT NOT NULL CHECK(mode IN('especes','virement','mobile_money','carte_en_ligne')), date TEXT NOT NULL, solde_apres_millimes INTEGER NOT NULL, annee_scolaire TEXT NOT NULL, deleted_at TEXT,
 canal TEXT NOT NULL DEFAULT 'guichet' CHECK(canal IN('guichet','en_ligne')), reference TEXT);
INSERT INTO paiements_new(id,eleve_id,montant_millimes,mode,date,solde_apres_millimes,annee_scolaire,deleted_at) SELECT id,eleve_id,montant_millimes,mode,date,solde_apres_millimes,annee_scolaire,deleted_at FROM paiements;
DROP TABLE paiements;
ALTER TABLE paiements_new RENAME TO paiements;
CREATE INDEX idx_pay_eleve ON paiements(eleve_id);
CREATE TABLE paiements_en_ligne(id INTEGER PRIMARY KEY, token TEXT UNIQUE NOT NULL, eleve_id INTEGER NOT NULL REFERENCES eleves(id), parent_id INTEGER NOT NULL REFERENCES users(id),
 montant_millimes INTEGER NOT NULL CHECK(montant_millimes>0), statut TEXT NOT NULL DEFAULT 'en_attente' CHECK(statut IN('en_attente','paye','echoue','annule','expire')),
 fournisseur TEXT NOT NULL DEFAULT 'simulation', paiement_id INTEGER REFERENCES paiements(id), created_at TEXT NOT NULL DEFAULT(datetime('now')));
ALTER TABLE matieres ADD COLUMN couleur TEXT;
ALTER TABLE matieres ADD COLUMN icone TEXT;
CREATE TABLE felicitations(id INTEGER PRIMARY KEY, eleve_id INTEGER NOT NULL REFERENCES eleves(id), enseignant_id INTEGER NOT NULL REFERENCES users(id), motif TEXT NOT NULL,
 icone TEXT NOT NULL DEFAULT 'etoile', date TEXT NOT NULL DEFAULT(date('now')), annee_scolaire TEXT NOT NULL);
CREATE INDEX idx_felic_eleve ON felicitations(eleve_id);
