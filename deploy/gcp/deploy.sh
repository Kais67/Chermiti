#!/usr/bin/env bash
# Déploie la plateforme sur Google Cloud : Cloud Run (HTTPS automatique) + Cloud SQL PostgreSQL + Cloud Storage (fichiers déposés).
# À lancer dans Google Cloud Shell (navigateur, rien à installer) à la racine du dépôt :  bash deploy/gcp/deploy.sh
# ⚠ CE SCRIPT CRÉE DES RESSOURCES PAYANTES (Cloud SQL surtout). Il demande une confirmation explicite. Voir docs/hebergement_google_cloud.md
set -euo pipefail
: "${PROJECT_ID:?Définir PROJECT_ID (ID du projet Google Cloud), ex. : export PROJECT_ID=mon-projet}"
REGION="${REGION:-europe-west1}"; SERVICE="${SERVICE:-multi-ecoles}"; SQL_INSTANCE="${SQL_INSTANCE:-multi-ecoles-pg}"; BUCKET="${BUCKET:-${PROJECT_ID}-fichiers-ecoles}"
SUPER_ADMIN_EMAIL="${SUPER_ADMIN_EMAIL:?Définir SUPER_ADMIN_EMAIL (compte du propriétaire de la plateforme)}"
echo "Projet : $PROJECT_ID · région : $REGION · service : $SERVICE"
echo "Ressources payantes qui seront créées : instance Cloud SQL « $SQL_INSTANCE » (facturée en continu), bucket « $BUCKET », service Cloud Run « $SERVICE »."
read -r -p "Tapez OUI pour confirmer que vous acceptez ces coûts : " OK; [ "$OK" = "OUI" ] || { echo "Annulé : rien n'a été créé."; exit 1; }
gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com storage.googleapis.com
# 1. Base PostgreSQL gérée (sauvegardes quotidiennes activées). Le rôle « postgres » peut créer une base par école.
gcloud sql instances describe "$SQL_INSTANCE" >/dev/null 2>&1 || gcloud sql instances create "$SQL_INSTANCE" --database-version=POSTGRES_16 --edition=ENTERPRISE --tier=db-f1-micro --region="$REGION" --backup-start-time=03:00 --storage-auto-increase
CONN="$(gcloud sql instances describe "$SQL_INSTANCE" --format='value(connectionName)')"
DBPASS="$(openssl rand -base64 24 | tr -d '/+=')"; gcloud sql users set-password postgres --instance="$SQL_INSTANCE" --password="$DBPASS"
gcloud sql databases describe plateforme --instance="$SQL_INSTANCE" >/dev/null 2>&1 || gcloud sql databases create plateforme --instance="$SQL_INSTANCE"
# 2. Secrets (Secret Manager) — TENANT_SECRET chiffre les URL des bases d'écoles : CONSERVEZ-LE aussi hors de Google Cloud
mk(){ printf '%s' "$2" | gcloud secrets create "$1" --data-file=- 2>/dev/null || printf '%s' "$2" | gcloud secrets versions add "$1" --data-file=-; }
mk jwt-secret "$(openssl rand -hex 32)"; mk tenant-secret "$(openssl rand -hex 32)"
mk platform-db-url "postgres://postgres:${DBPASS}@/plateforme?host=/cloudsql/${CONN}"; mk pg-admin-url "postgres://postgres:${DBPASS}@/postgres?host=/cloudsql/${CONN}"
SAPASS="$(openssl rand -base64 18 | tr -d '/+=')#7a"; mk super-admin-password "$SAPASS"
# 3. Stockage des fichiers déposés (photos, devoirs, pièces jointes) monté dans le conteneur
gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 || gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access
PN="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"; SA="${PN}-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" --role=roles/cloudsql.client >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" --role=roles/storage.objectAdmin >/dev/null
# 4. Construction (Dockerfile du dépôt) et déploiement. HTTPS : certificat géré par Google sur l'adresse *.run.app (ou votre domaine)
gcloud run deploy "$SERVICE" --source . --region "$REGION" --allow-unauthenticated --execution-environment=gen2 --port 3000 \
  --add-cloudsql-instances "$CONN" --add-volume=name=fichiers,type=cloud-storage,bucket="$BUCKET" --add-volume-mount=volume=fichiers,mount-path=/mnt/fichiers \
  --min-instances "${MIN_INSTANCES:-0}" --max-instances 5 --memory 512Mi \
  --set-env-vars "NODE_ENV=production,TRUST_PROXY=1,UPLOADS_DIR=/mnt/fichiers,TENANT_POOL_MAX=2,TENANTS_CACHE=10,SUPER_ADMIN_EMAIL=${SUPER_ADMIN_EMAIL}" \
  --set-secrets "JWT_SECRET=jwt-secret:latest,TENANT_SECRET=tenant-secret:latest,PLATFORM_DATABASE_URL=platform-db-url:latest,PG_ADMIN_URL=pg-admin-url:latest,SUPER_ADMIN_PASSWORD=super-admin-password:latest"
URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
gcloud run services update "$SERVICE" --region "$REGION" --update-env-vars "PUBLIC_URL=${URL}" >/dev/null
echo; echo "✅ Plateforme en ligne (HTTPS) : $URL"; echo "Console de gestion des écoles : $URL/plateforme"
echo "Super-administrateur : $SUPER_ADMIN_EMAIL · mot de passe temporaire : $SAPASS   (notez-le puis changez-le)"
echo "Pour l'application mobile : variable GitHub API_URL = $URL"
