# Appraisal Bot — HR Admin (Frontend)

Vite + React + Material UI admin app for HR to manage categories, questionnaires, employees, and review cycles.

## Setup

```bash
cd frontend
npm install
npm run dev
```

App opens at `http://localhost:5173`.

## Pages
- **/categories** — CRUD employee categories
- **/questionnaires** — CRUD questions, filter by category
- **/employees** — Read-only list with role filter
- **/cycles** — Create & edit review cycles (with notify intervals)

## How it talks to the backend
Vite dev server proxies `/api/*` → `http://localhost:4000` (see `vite.config.js`). Make sure the backend is running on port 4000 before starting the frontend.

## Structure
```
src/
  api/client.js       — axios wrapper, all endpoints
  pages/              — one file per page
  App.jsx             — layout shell + router
  main.jsx            — entry point + MUI theme
```
