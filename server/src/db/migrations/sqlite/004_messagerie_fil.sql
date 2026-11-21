ALTER TABLE messages ADD COLUMN eleve_id INTEGER REFERENCES eleves(id);
ALTER TABLE messages ADD COLUMN reponse_a INTEGER REFERENCES messages(id);
CREATE INDEX idx_messages_fil ON messages(expediteur_id,destinataire_id,eleve_id);
