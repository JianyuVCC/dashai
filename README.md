# Dashboard Builder

A self-contained web app that turns **any** uploaded spreadsheet into an interactive dashboard. Upload an `.xlsx`, `.xls`, `.xlsm`, `.csv`, or `.tsv` file and the app automatically profiles the data — detecting numeric, date, and categorical columns — then generates KPI cards, filters, and configurable charts. Nothing about the file structure is hard-coded, so the same deployment works for whatever spreadsheet your team uploads later.

Built to run as a stateless Docker container and deploy to **Azure Container Apps** behind **Microsoft Entra ID** single sign-on, so it satisfies common corporate cybersecurity requirements.

## What it does

- **Auto-profiling** — infers each column's type at runtime; recovers dates and numbers that came through as text.
- **Multi-sheet** — every sheet in a workbook is selectable.
- **KPI cards** — row/column counts plus totals and averages for numeric columns.
- **Interactive charts** — bar, line, scatter, box, histogram, pie; pick X/Y, grouping colour, and aggregation (sum/mean/count).
- **Filters** — categorical columns become multi-select filters.
- **Data preview & column profile** — table view with type, non-null, and unique counts.
- **Ask AI about your data** — a natural-language Q&A panel. Type a question ("Which region has the highest total revenue?") and get an answer grounded in the active sheet. Backed by **Azure OpenAI** so questions and data stay inside your tenant.
- **Stateless** — uploaded data lives in the browser session only; nothing is written to the server's disk. This keeps the compliance surface small.

## AI Q&A setup (Azure OpenAI)

The AI panel is optional and off until you configure it. It uses Azure OpenAI (not a public API) so data never leaves your cloud. Set these environment variables on the Container App:

| Variable | Purpose |
|----------|---------|
| `AZURE_OPENAI_ENDPOINT` | e.g. `https://my-aoai.openai.azure.com` |
| `AZURE_OPENAI_DEPLOYMENT` | your chat model deployment name (e.g. `gpt-4o`) |
| `AZURE_OPENAI_API_VERSION` | optional, defaults to `2024-06-01` |
| `AZURE_OPENAI_API_KEY` | key auth — **or** omit and use managed identity |
| `AI_SAMPLE_ROWS` | rows of sample data sent for context (default 5) |

`deploy-azure.sh` has a block for these near the top — fill in the endpoint and deployment and it wires them up automatically. If you leave `AZURE_OPENAI_API_KEY` blank, the script assigns the app a managed identity (no secrets); grant that identity the **Cognitive Services OpenAI User** role on your Azure OpenAI resource. Only a compact summary of the sheet (schema, aggregate stats, and a small sample) is sent to the model — not the full dataset.

## Run locally

```bash
pip install -r requirements.txt
python app.py
# open http://localhost:8050
```

Or with Docker:

```bash
docker build -t dashboard-builder .
docker run -p 8050:8050 dashboard-builder
# open http://localhost:8050
```

## Deploy to Azure (with SSO)

The included `deploy-azure.sh` does the full path: builds the image in your private Azure Container Registry, deploys it to Azure Container Apps, then enables Microsoft Entra ID "Easy Auth" so only signed-in members of your tenant can reach it.

```bash
# 1. Edit the variables at the top of deploy-azure.sh (resource group, region, names).
# 2. Log in and run it:
az login
chmod +x deploy-azure.sh
./deploy-azure.sh
```

When it finishes you get an HTTPS URL. Anyone in your Entra tenant can sign in; to restrict to specific people or groups, go to **Entra admin center → Enterprise applications → Dashboard Builder → Users and groups** and set **Assignment required = Yes**.

### Compliance notes

- **Authentication is platform-level (Easy Auth).** Login is enforced by Azure before a request ever reaches the container — no auth code in the app to audit or get wrong. Backed by your corporate Entra directory, so it inherits MFA and Conditional Access policies.
- **Private registry.** The image is built and stored in your own Azure Container Registry (`admin-enabled false`, RBAC/managed-identity pull). No public images.
- **Non-root container.** The Dockerfile runs as an unprivileged user (`uid 10001`).
- **No data at rest.** The app never persists uploaded files; data is held in the browser session. Restart wipes everything.
- **Internal-only option.** For the strictest setups, change `--ingress external` to `--ingress internal` in `deploy-azure.sh` so the app is only reachable from inside your VNet (pair with private endpoints / VPN).
- **HTTPS by default.** Container Apps terminates TLS automatically.

### Alternative: Azure App Service

If your org standardizes on App Service for Containers instead of Container Apps, the same image deploys there, and Easy Auth is configured the same way (Authentication blade → add Microsoft identity provider). Ask and I can add an App Service variant of the deploy script.

## Files

| File | Purpose |
|------|---------|
| `app.py` | The Dash application (single file: data engine + UI + inline CSS). |
| `requirements.txt` | Python dependencies. |
| `Dockerfile` | Production container (gunicorn, non-root). |
| `deploy-azure.sh` | One-shot Azure Container Apps deploy + Entra SSO. |
| `.dockerignore` / `.gitignore` | Build/VCS hygiene. |

## Notes & limits

- Very large files (100k+ rows) are held in browser memory; for big data, downsample or point the app at a database instead (can be added).
- Aggregations default to `sum`; switch to `mean`/`count`/`none` in the chart controls.
- The data engine (parsing, type inference, aggregation) is covered by a smoke test against a multi-sheet sample workbook and verified to classify dates/numbers/categories correctly.
