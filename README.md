# Supply Chain

Modern full-stack supply chain dashboard built with React on the frontend and Flask/MySQL on the backend.

## What is included

- Dashboard with summary cards for orders, revenue, and inventory alerts.
- Orders, inventory, shipments, and payments views.
- Sidebar navigation with a polished responsive layout.
- MySQL-backed Flask API with a sample-data fallback when credentials are not configured yet.

## Folder layout

- `backend/` Flask API, MySQL access, and sample fallback data.
- `frontend/` React app built with Vite and Bun.

## MySQL setup

The backend looks for these environment variables:

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

Copy `backend/.env.example` to `backend/.env` and fill in the values for your local MySQL server.

If you do not know the username or password yet:

1. Open your MySQL client or MySQL Workbench connection settings.
2. Note the host and port shown in the connection configuration, usually `localhost` and `3306`.
3. Read the username from the same connection profile.
4. The password is usually not displayed by the client. If you forgot it, you will need to reset it or create a new MySQL user in your local installation.
5. Put the confirmed values into `backend/.env`.

The app can still run without these values because the backend falls back to sample data.

## Backend run

From the `backend/` folder:

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The API will be available at `http://localhost:5000`.

Useful endpoints:

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/orders`
- `GET /api/orders/<id>`
- `GET /api/inventory`
- `GET /api/shipments`
- `GET /api/payments`
- `GET /api/retailers`

## Frontend run

From the `frontend/` folder:

```bash
bun install
bun run dev
```

The frontend expects the backend at `/api` during development, which is already proxied in `vite.config.js`.

## Notes for the next CRUD phase

The current build is read-first on purpose. The UI already has modal patterns for create/update workflows, so adding POST and PUT endpoints later will be a small follow-up rather than a rewrite.
