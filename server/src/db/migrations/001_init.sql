CREATE TABLE annees_scolaires(id INTEGER PRIMARY KEY, libelle TEXT UNIQUE NOT NULL, active INTEGER NOT NULL DEFAULT 0 CHECK(active IN(0,1)));
CREATE TABLE users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, nom TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN('admin','enseignant','parent','eleve','comptable')), deleted_at TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE classes(id INTEGER PRIMARY KEY, niveau TEXT NOT NULL, section TEXT NOT NULL DEFAULT 'A', capacite INTEGER NOT NULL CHECK(capacite>0),
 titulaire_id INTEGER REFERENCES users(id), annee_scolaire TEXT NOT NULL, deleted_at TEXT, UNIQUE(niveau,section,annee_scolaire));
CREATE TABLE matieres(id INTEGER PRIMARY KEY, nom TEXT NOT NULL, coefficient REAL NOT NULL CHECK(coefficient>0), niveau TEXT NOT NULL, deleted_at TEXT, UNIQUE(nom,niveau));
CREATE TABLE eleves(id INTEGER PRIMARY KEY, nom TEXT NOT NULL, prenom TEXT NOT NULL, date_naissance TEXT NOT NULL, classe_id INTEGER REFERENCES classes(id),
 user_id INTEGER REFERENCES users(id), antecedents_medicaux TEXT, annee_entree TEXT NOT NULL, annee_scolaire TEXT NOT NULL, deleted_at TEXT);
CREATE TABLE parent_eleve(parent_id INTEGER NOT NULL REFERENCES users(id), eleve_id INTEGER NOT NULL REFERENCES eleves(id), PRIMARY KEY(parent_id,eleve_id));
CREATE TABLE salles(id INTEGER PRIMARY KEY, nom TEXT UNIQUE NOT NULL, capacite INTEGER NOT NULL, disponible INTEGER NOT NULL DEFAULT 1, deleted_at TEXT);
CREATE TABLE creneaux(id INTEGER PRIMARY KEY, classe_id INTEGER NOT NULL REFERENCES classes(id), matiere_id INTEGER NOT NULL REFERENCES matieres(id),
 enseignant_id INTEGER NOT NULL REFERENCES users(id), salle_id INTEGER NOT NULL REFERENCES salles(id), jour INTEGER NOT NULL CHECK(jour BETWEEN 1 AND 6),
 debut TEXT NOT NULL, fin TEXT NOT NULL CHECK(fin>debut), annee_scolaire TEXT NOT NULL);
CREATE TABLE evaluations(id INTEGER PRIMARY KEY, classe_id INTEGER NOT NULL REFERENCES classes(id), matiere_id INTEGER NOT NULL REFERENCES matieres(id),
 titre TEXT NOT NULL, trimestre INTEGER NOT NULL CHECK(trimestre IN(1,2,3)), bareme REAL NOT NULL DEFAULT 20, annee_scolaire TEXT NOT NULL);
CREATE TABLE notes(id INTEGER PRIMARY KEY, evaluation_id INTEGER NOT NULL REFERENCES evaluations(id), eleve_id INTEGER NOT NULL REFERENCES eleves(id),
 valeur REAL NOT NULL CHECK(valeur>=0), annee_scolaire TEXT NOT NULL, UNIQUE(evaluation_id,eleve_id));
CREATE TABLE frais(id INTEGER PRIMARY KEY, eleve_id INTEGER NOT NULL REFERENCES eleves(id), libelle TEXT NOT NULL, montant_millimes INTEGER NOT NULL CHECK(montant_millimes>0), annee_scolaire TEXT NOT NULL);
CREATE TABLE paiements(id INTEGER PRIMARY KEY, eleve_id INTEGER NOT NULL REFERENCES eleves(id), montant_millimes INTEGER NOT NULL CHECK(montant_millimes>0),
 mode TEXT NOT NULL CHECK(mode IN('especes','virement','mobile_money')), date TEXT NOT NULL, solde_apres_millimes INTEGER NOT NULL, annee_scolaire TEXT NOT NULL, deleted_at TEXT);
CREATE TABLE messages(id INTEGER PRIMARY KEY, expediteur_id INTEGER REFERENCES users(id), destinataire_id INTEGER NOT NULL REFERENCES users(id),
 objet TEXT NOT NULL, corps TEXT NOT NULL, brouillon INTEGER NOT NULL DEFAULT 0, masque_destinataire INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TRIGGER messages_immuables BEFORE UPDATE ON messages WHEN OLD.brouillon=0 AND (NEW.objet<>OLD.objet OR NEW.corps<>OLD.corps OR NEW.brouillon<>OLD.brouillon) BEGIN SELECT RAISE(ABORT,'Message envoyé immuable'); END;
CREATE TRIGGER messages_no_delete BEFORE DELETE ON messages WHEN OLD.brouillon=0 BEGIN SELECT RAISE(ABORT,'Message envoyé non supprimable'); END;
CREATE TABLE notifications(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), texte TEXT NOT NULL, lue INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE audit_log(id INTEGER PRIMARY KEY, user_id INTEGER, entite TEXT NOT NULL, entite_id INTEGER, action TEXT NOT NULL, anciennes TEXT, nouvelles TEXT, date TEXT NOT NULL DEFAULT(datetime('now')));
CREATE INDEX idx_eleves_classe ON eleves(classe_id); CREATE INDEX idx_notes_eleve ON notes(eleve_id); CREATE INDEX idx_pay_eleve ON paiements(eleve_id);
