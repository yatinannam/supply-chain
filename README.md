# Supply Chain

A full-stack supply chain workflow app built with React, Flask, and MySQL. The frontend presents the business process as five working modules instead of exposing raw database tables:

- Dashboard
- Orders
- Inventory
- Shipments
- Payments

The app reads live data from MySQL when the backend environment is configured. If MySQL credentials are missing, the backend falls back to sample data so the UI still loads.

## Features

- Dashboard with live totals for orders, revenue, low inventory alerts, and shipments in transit.
- Orders workflow with retailer lookup, order creation, status updates, and order details.
- Inventory workflow with stock visibility, low-stock highlighting, and quantity updates.
- Shipments workflow with create and edit actions for shipment routing and status.
- Payments workflow with payment creation, payment edits, and payment history.
- Readable JOIN-based API responses so the UI shows business names and statuses instead of raw IDs.

## Project Structure

- `backend/` Flask API, MySQL access, and sample fallback data.
- `frontend/` React app built with Vite and Bun.

## Requirements

- Python 3.10+ recommended
- Node/Bun for the frontend
- A MySQL database named `supplychaindb` or a compatible schema

## MySQL Configuration

Set these environment variables in `backend/.env`:

- `MYSQL_HOST`
- `MYSQL_PORT`  
  Optional. Defaults to `3306` if omitted.
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

Example:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=supplychaindb
```

If these values are present, the backend uses MySQL. If they are not present, the backend serves the sample fallback data.

## Run the Backend

From the `backend/` folder:

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The API will be available at `http://localhost:5000`.

Health check:

```http
GET /api/health
```

Useful API endpoints:

- `GET /api/dashboard`
- `GET /api/orders`
- `GET /api/orders/<id>`
- `POST /api/orders`
- `PUT /api/orders/<id>`
- `DELETE /api/orders/<id>`
- `GET /api/inventory`
- `PUT /api/inventory/<id>`
- `DELETE /api/inventory/<id>`
- `GET /api/shipments`
- `POST /api/shipments`
- `PUT /api/shipments/<id>`
- `DELETE /api/shipments/<id>`
- `GET /api/payments`
- `POST /api/payments`
- `PUT /api/payments/<id>`
- `DELETE /api/payments/<id>`
- `GET /api/retailers`

## Run the Frontend

From the `frontend/` folder:

```powershell
bun install
bun run dev
```

Open the Vite URL shown in the terminal. The frontend talks to the backend through `/api` during development.

## Data Model Notes

The MySQL database contains many normalized tables, but the UI only surfaces the business workflow pages listed above. Internally, the backend joins related tables so the frontend can show readable values such as retailer names, shipment routes, and payment statuses.

## Verification

A quick production check should succeed with:

```powershell
cd frontend
bun run build
```

And the backend health endpoint should report `source: mysql` when your environment variables are configured correctly.
