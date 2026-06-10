# Orcanos Importer

A web application for importing data into Orcanos with multi-step wizard UI.

## Project Structure

```
/orcanos-importer
  /frontend       - React + Vite + Tailwind CSS
  /backend        - Python Flask API
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:5173

## Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Runs on http://localhost:5000

## Features

- Step 1: Authorization (Basic Auth / API Key)
- Step 2: Upload File
- Step 3: Map Fields
- Step 4: Import Data

## Testing

Test backend:
```bash
curl http://localhost:5000/ping
```
