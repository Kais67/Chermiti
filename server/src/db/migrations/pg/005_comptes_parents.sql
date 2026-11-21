ALTER TABLE users ADD COLUMN mdp_temporaire INTEGER NOT NULL DEFAULT 0 CHECK(mdp_temporaire IN(0,1));
ALTER TABLE preinscriptions ADD COLUMN eleve_id INTEGER REFERENCES eleves(id);
