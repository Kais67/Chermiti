-- no-transaction
-- Ajoute le rôle « directeur » : SQLite ne sait pas modifier une contrainte CHECK, on reconstruit la table users (procédure officielle en 12 étapes).
BEGIN IMMEDIATE;
CREATE TABLE users_new(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, nom TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN('admin','directeur','enseignant','parent','eleve','comptable')), deleted_at TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')),
 telephone TEXT, adresse TEXT, mdp_temporaire INTEGER NOT NULL DEFAULT 0 CHECK(mdp_temporaire IN(0,1)));
INSERT INTO users_new(id,email,password_hash,nom,role,deleted_at,created_at,telephone,adresse,mdp_temporaire) SELECT id,email,password_hash,nom,role,deleted_at,created_at,telephone,adresse,mdp_temporaire FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
COMMIT;
