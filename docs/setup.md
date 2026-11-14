# Setup Instructions

These steps describe the current local development workflow on Windows PowerShell. Use the versions and dependency pins in the repository's own dependency files as the source of truth.

## Prerequisites

Install Git, a Python version supported by the existing analyzer (the development environment has used Python 3.8), Node.js 18.18+ with npm, and Docker Desktop with Docker Compose enabled. Some legacy analyzer or PDF dependencies may require OS-specific libraries.

## 1. Clone the repository

If you do not already have a working copy:

```powershell
git clone https://github.com/Brenisdone/GDPR-Analyzer.git
cd GDPR-Analyzer
```

If you already have the project locally, use its existing directory instead of cloning over it.

## 2. Create or activate the Python environment

The Python side is now only the analyzer engine and its bridge. Activate your existing environment, or create one (Python 3.8+):

```powershell
py -3.8 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

The analyzer also needs Firefox and geckodriver on PATH. FastAPI, SQLAlchemy and psycopg are no longer required. Avoid upgrading the pinned analyzer dependencies.

## 3. Configure environment variables

Copy `.env.example` to `.env` in the repository root (next to `compose.yaml`) and edit it:

```dotenv
MONGO_PASSWORD=your-local-database-password
MONGODB_URI=mongodb://gdpr_user:your-local-database-password@127.0.0.1:27017/gdpr_analyzer?authSource=admin
PYTHON_BIN=python
```

Use the same password in both variables (URL-encode special characters in the URI). `PYTHON_BIN` must point at the interpreter that has `requirements.txt` installed; with an activated venv, `python` is usually right. `.env` is git-ignored. Optional settings: `PORT`, `SCAN_TIMEOUT_MS`, `MAX_CONCURRENT_SCANS`, `CORS_ORIGINS`.

## 4. Install npm dependencies

```powershell
npm --prefix server install
npm --prefix frontend install
```

## 5. Start the application

From the frontend folder, with the Python virtual environment activated:

```powershell
npm run dev
```

This starts MongoDB through Docker Compose, the Express API (`node --watch`), and the Vite dev server together.

| Command (run in `frontend/`) | Purpose |
|---|---|
| `npm run db` | Start MongoDB using Docker Compose |
| `npm run backend` | Start MongoDB and the Express API |
| `npm run frontend` | Start the React + Vite frontend |
| `npm run dev` | Start everything |

Verify the API at `http://127.0.0.1:8000/api/health`, then open the Vite URL (normally `http://localhost:5173`). Vite proxies `/api` to port 8000.

MongoDB keeps running in Docker after the app stops. To stop it without deleting data:

```powershell
docker compose stop mongo
```

## 6. Test the integrated workflow

1. Open the dashboard in your browser.
2. Submit a public site you own or are authorized to assess.
3. Wait for the API request to complete.
4. Review the overall grade, each assessment module, transmission-security details, and history.
5. Open a historical scan to confirm persistence.
6. Download the JSON and PDF reports for the same scan and compare them with the dashboard's data.

Do not interpret an empty findings collection as proof that no cookies or tracking technologies exist; the analyzer's detection coverage and error behavior determine what an empty field means.

## Useful commands

```powershell
# Start the entire application
npm run dev

# Start only MongoDB
npm run db

# Start the backend, including MongoDB
npm run backend

# Start only the frontend
npm run frontend

# Inspect MongoDB status and logs
docker compose ps
docker compose logs -f mongo

# Stop MongoDB without deleting stored data
docker compose stop mongo

# Check local Git changes
git status --short
```

Avoid `docker compose down -v` unless you intentionally want to delete the database volume and all data stored in it.

## Troubleshooting

- **API cannot reach MongoDB:** check container health (`docker compose ps`), port 27017, and `MONGODB_URI`. The password must match `MONGO_PASSWORD`. If you changed the password after first start, the existing volume keeps the old one.
- **"Could not start the Python analyzer":** set `PYTHON_BIN` to the interpreter with `requirements.txt` installed.
- **Scan times out:** raise `SCAN_TIMEOUT_MS`.
- **Frontend cannot reach API:** confirm that both servers are running and inspect `frontend/vite.config.js` for the `/api` proxy.
- **A target scan fails:** check the API terminal traceback and confirm the target is publicly reachable. Some sites block automated requests, use bot defenses, or rely on JavaScript to populate content.
- **PDF report generation fails:** inspect the traceback and the report library's native dependency requirements before reinstalling packages or changing versions.
- **Package installation fails:** confirm the active Python version and use the repository's pinned dependencies where available.
