-- Back-office SaaS : abonnement et contact de chaque école cliente
ALTER TABLE ecoles ADD COLUMN plan TEXT NOT NULL DEFAULT 'essai' CHECK(plan IN('essai','standard','premium'));
ALTER TABLE ecoles ADD COLUMN fin_abonnement TEXT;
ALTER TABLE ecoles ADD COLUMN contact_nom TEXT;
ALTER TABLE ecoles ADD COLUMN contact_email TEXT;
