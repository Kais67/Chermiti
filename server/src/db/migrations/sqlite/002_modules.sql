CREATE TABLE devoirs(id INTEGER PRIMARY KEY, classe_id INTEGER NOT NULL REFERENCES classes(id), matiere_id INTEGER NOT NULL REFERENCES matieres(id), enseignant_id INTEGER NOT NULL REFERENCES users(id),
 titre TEXT NOT NULL, description TEXT, date_remise TEXT NOT NULL, bareme REAL NOT NULL DEFAULT 20 CHECK(bareme>0), piece_jointe TEXT, piece_nom TEXT, correction TEXT, correction_nom TEXT, annee_scolaire TEXT NOT NULL, deleted_at TEXT);
CREATE TABLE depots(id INTEGER PRIMARY KEY, devoir_id INTEGER NOT NULL REFERENCES devoirs(id), eleve_id INTEGER NOT NULL REFERENCES eleves(id), fichier TEXT NOT NULL, original_name TEXT NOT NULL,
 date_depot TEXT NOT NULL, note REAL CHECK(note>=0), commentaire TEXT, vu_parent INTEGER NOT NULL DEFAULT 0, UNIQUE(devoir_id,eleve_id));
CREATE TABLE absences(id INTEGER PRIMARY KEY, eleve_id INTEGER NOT NULL REFERENCES eleves(id), date TEXT NOT NULL, motif TEXT, justifiee INTEGER NOT NULL DEFAULT 0 CHECK(justifiee IN(0,1)), justification TEXT, annee_scolaire TEXT NOT NULL);
CREATE TABLE annonces(id INTEGER PRIMARY KEY, auteur_id INTEGER NOT NULL REFERENCES users(id), titre TEXT NOT NULL, corps TEXT NOT NULL, cible TEXT NOT NULL CHECK(cible IN('tous','parents','enseignants','eleves')), created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TRIGGER annonces_no_update BEFORE UPDATE ON annonces BEGIN SELECT RAISE(ABORT,'Annonce immuable'); END;
CREATE TRIGGER annonces_no_delete BEFORE DELETE ON annonces BEGIN SELECT RAISE(ABORT,'Annonce non supprimable'); END;
CREATE TABLE preinscriptions(id INTEGER PRIMARY KEY, nom TEXT NOT NULL, prenom TEXT NOT NULL, date_naissance TEXT NOT NULL, parent_nom TEXT NOT NULL, parent_email TEXT NOT NULL,
 consentement INTEGER NOT NULL CHECK(consentement=1), statut TEXT NOT NULL DEFAULT 'en_attente' CHECK(statut IN('en_attente','validee','refusee')), created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE acces_messages(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, message_id INTEGER NOT NULL, date TEXT NOT NULL DEFAULT(datetime('now')));
CREATE INDEX idx_depots_devoir ON depots(devoir_id); CREATE INDEX idx_abs_eleve ON absences(eleve_id);
