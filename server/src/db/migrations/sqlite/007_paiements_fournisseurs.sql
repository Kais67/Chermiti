-- Paiements : identification explicite des paiements simulés/test, configuration des fournisseurs par école,
-- demandes de paiement en espèces à valider par le secrétariat.
ALTER TABLE paiements ADD COLUMN simule INTEGER NOT NULL DEFAULT 0 CHECK(simule IN(0,1));
UPDATE paiements SET simule=1 WHERE reference LIKE 'SIM-%';
ALTER TABLE paiements_en_ligne ADD COLUMN reference_externe TEXT;
ALTER TABLE paiements_en_ligne ADD COLUMN simule INTEGER NOT NULL DEFAULT 1 CHECK(simule IN(0,1));
UPDATE paiements_en_ligne SET fournisseur='demo' WHERE fournisseur='simulation';
CREATE TABLE config_paiement(fournisseur TEXT PRIMARY KEY CHECK(fournisseur IN('demo','flouci','konnect')), actif INTEGER NOT NULL DEFAULT 0 CHECK(actif IN(0,1)),
 mode TEXT NOT NULL DEFAULT 'sandbox' CHECK(mode IN('sandbox','live')), secrets TEXT, updated_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE demandes_especes(id INTEGER PRIMARY KEY, reference TEXT UNIQUE NOT NULL, eleve_id INTEGER NOT NULL REFERENCES eleves(id), parent_id INTEGER NOT NULL REFERENCES users(id),
 montant_millimes INTEGER NOT NULL CHECK(montant_millimes>0), statut TEXT NOT NULL DEFAULT 'en_attente' CHECK(statut IN('en_attente','validee','refusee','annulee','expiree')),
 paiement_id INTEGER REFERENCES paiements(id), traite_par INTEGER REFERENCES users(id), traite_le TEXT, motif TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE INDEX idx_dem_esp_statut ON demandes_especes(statut);
