-- PlatformDB : registre central des écoles (aucune donnée scolaire ici)
CREATE TABLE ecoles(id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, nom TEXT NOT NULL,
 statut TEXT NOT NULL DEFAULT 'active' CHECK(statut IN('active','suspendue','archivee')),
 db_driver TEXT NOT NULL CHECK(db_driver IN('sqlite','pg')), db_ref TEXT NOT NULL,
 langue_defaut TEXT NOT NULL DEFAULT 'fr' CHECK(langue_defaut IN('fr','ar','en')), uploads_dir TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE super_admins(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, nom TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE audit_plateforme(id INTEGER PRIMARY KEY, super_admin_id INTEGER, action TEXT NOT NULL, ecole_slug TEXT, details TEXT, date TEXT NOT NULL DEFAULT(datetime('now')));
