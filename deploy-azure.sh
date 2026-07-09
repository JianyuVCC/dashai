#!/usr/bin/env bash
#
# Deploy the Dashboard Builder to Azure Container Apps, then lock it down with
# Microsoft Entra ID built-in authentication ("Easy Auth").
#
# Prereqs: az CLI logged in (`az login`), Docker running, and permission to
# create resources + register an Entra app in your tenant. Adjust the variables
# below to match your company's naming and region conventions.
#
# Run:  chmod +x deploy-azure.sh && ./deploy-azure.sh
set -euo pipefail

# ---------------------------------------------------------------------------
# 0. Configuration — EDIT THESE
# ---------------------------------------------------------------------------
RESOURCE_GROUP="rg-dashboard"
LOCATION="eastus"
ACR_NAME="acrdashboard$RANDOM"      # must be globally unique, lowercase alphanumeric
ENVIRONMENT="env-dashboard"
APP_NAME="dashboard-builder"
IMAGE_TAG="dashboard-builder:1.0"
APP_DISPLAY_NAME="Dashboard Builder"

# --- Optional: AI Q&A via Azure OpenAI (leave blank to disable the AI panel) ---
# Point these at an Azure OpenAI resource in YOUR tenant so data stays in-cloud.
AZURE_OPENAI_ENDPOINT=""          # e.g. https://my-aoai.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=""        # your chat model deployment name, e.g. gpt-4o
AZURE_OPENAI_API_KEY=""           # leave blank to use managed identity instead

# ---------------------------------------------------------------------------
# 1. One-time CLI setup
# ---------------------------------------------------------------------------
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights

# ---------------------------------------------------------------------------
# 2. Resource group + container registry (private)
# ---------------------------------------------------------------------------
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

az acr create --resource-group "$RESOURCE_GROUP" --name "$ACR_NAME" \
  --sku Standard --admin-enabled false

# Build the image in ACR (no local Docker push needed; keeps source in your tenant).
az acr build --registry "$ACR_NAME" --image "$IMAGE_TAG" .

ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)

# ---------------------------------------------------------------------------
# 3. Container Apps environment + the app
#    --ingress external exposes it on HTTPS; switch to 'internal' if you only
#    want it reachable from inside your VNet (most compliance-strict setups).
# ---------------------------------------------------------------------------
az containerapp env create --name "$ENVIRONMENT" \
  --resource-group "$RESOURCE_GROUP" --location "$LOCATION"

az containerapp create \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$ENVIRONMENT" \
  --image "$ACR_LOGIN_SERVER/$IMAGE_TAG" \
  --registry-server "$ACR_LOGIN_SERVER" \
  --registry-identity system \
  --target-port 8050 \
  --ingress external \
  --min-replicas 1 --max-replicas 3 \
  --cpu 0.5 --memory 1.0Gi \
  --query properties.configuration.ingress.fqdn -o tsv

# Wire up Azure OpenAI env vars if provided (enables the AI Q&A panel).
if [ -n "$AZURE_OPENAI_ENDPOINT" ] && [ -n "$AZURE_OPENAI_DEPLOYMENT" ]; then
  echo "Configuring Azure OpenAI for the AI Q&A panel…"
  AI_ENV="AZURE_OPENAI_ENDPOINT=$AZURE_OPENAI_ENDPOINT AZURE_OPENAI_DEPLOYMENT=$AZURE_OPENAI_DEPLOYMENT"
  if [ -n "$AZURE_OPENAI_API_KEY" ]; then
    AI_ENV="$AI_ENV AZURE_OPENAI_API_KEY=$AZURE_OPENAI_API_KEY"
  else
    # No key: give the app a managed identity so it can call Azure OpenAI with RBAC.
    az containerapp identity assign --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --system-assigned
    echo "Grant this app's managed identity the 'Cognitive Services OpenAI User' role on your Azure OpenAI resource."
  fi
  az containerapp update --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
    --set-env-vars $AI_ENV
fi

FQDN=$(az containerapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
  --query properties.configuration.ingress.fqdn -o tsv)
echo "App is live (currently OPEN) at: https://$FQDN"

# ---------------------------------------------------------------------------
# 4. Lock it down with Microsoft Entra ID (Easy Auth)
#    After this, only signed-in users in your tenant can reach the app.
# ---------------------------------------------------------------------------
APP_ID=$(az ad app create \
  --display-name "$APP_DISPLAY_NAME" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "https://$FQDN/.auth/login/aad/callback" \
  --enable-id-token-issuance true \
  --query appId -o tsv)

az ad sp create --id "$APP_ID" || true
CLIENT_SECRET=$(az ad app credential reset --id "$APP_ID" \
  --display-name "$APP_DISPLAY_NAME-secret" --query password -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

az containerapp auth microsoft update \
  --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
  --client-id "$APP_ID" --client-secret "$CLIENT_SECRET" \
  --tenant-id "$TENANT_ID" \
  --issuer "https://login.microsoftonline.com/$TENANT_ID/v2.0" \
  --yes

# Require login for every request (no anonymous access).
az containerapp auth update \
  --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
  --unauthenticated-client-action RedirectToLoginPage

echo "-------------------------------------------------------------"
echo "Done. Secured dashboard: https://$FQDN"
echo "Only members of your Entra tenant can sign in."
echo "Grant/restrict specific users in: Entra admin center >"
echo "  Enterprise applications > $APP_DISPLAY_NAME > Users and groups"
echo "  (set 'Assignment required' = Yes to limit to named users/groups)."
echo "-------------------------------------------------------------"
