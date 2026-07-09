# Deployment Guide

**Free hosting:** Supabase (database + storage) · Render (backend) · Vercel (frontend)

---

## 1. Supabase — database & storage (free)

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. Go to **SQL Editor** and run the entire contents of `supabase/migration.sql`.
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Anthropic API key

Get your key at [console.anthropic.com](https://console.anthropic.com) → API Keys.

---

## 3. Backend — Render (free)

1. Push the repo to GitHub.
2. Go to [render.com](https://render.com) → **New → Web Service**.
3. Connect your GitHub repo.
4. Settings:
   - **Root directory:** `backend`
   - **Runtime:** Python 3
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free
5. Add environment variables (from **Environment** tab):

   | Variable | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your Anthropic key |
   | `SUPABASE_URL` | from step 1 |
   | `SUPABASE_ANON_KEY` | from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 1 |
   | `ENCRYPTION_KEY` | run: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
   | `CORS_ORIGINS` | `["https://your-app.vercel.app"]` (update after step 4) |

6. Click **Create Web Service**. Note the URL, e.g. `https://dashai-backend.onrender.com`.

> **Note:** Render free tier spins down after 15 min of inactivity; first request after sleep takes ~30 s.

---

## 4. Frontend — Vercel (free)

1. Go to [vercel.com](https://vercel.com) → **New Project**.
2. Import the same GitHub repo.
3. Set **Root Directory** to `frontend`.
4. Add environment variables:

   | Variable | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Supabase URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |
   | `VITE_API_URL` | your Render backend URL (e.g. `https://dashai-backend.onrender.com`) |

5. Click **Deploy**. Note the Vercel URL (e.g. `https://dashai.vercel.app`).

6. Go back to **Render → Environment** and update `CORS_ORIGINS` to your Vercel URL:
   ```
   ["https://dashai.vercel.app"]
   ```
   Then redeploy the backend.

---

## 5. Supabase Auth — allow your domain

In Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://dashai.vercel.app`
- **Redirect URLs:** `https://dashai.vercel.app/*`

---

## Local development

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in values
uvicorn main:app --reload

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

Open `http://localhost:5173`.

---

## Architecture

```
Browser (Vercel)
    │  Supabase Auth JWT
    ▼
FastAPI Backend (Render)
    ├── Supabase Storage (uploaded files as Parquet)
    ├── Supabase DB (datasets, dashboards, connections)
    └── Anthropic Claude (dashboard generation + chat)
```
