# DB Setup — Appraisal Bot (Neon)

Using [Neon](https://neon.tech) — serverless Postgres with a generous free tier. No local install needed.

## Prerequisites
- `psql` CLI installed locally (only tool you need)
  - macOS: `brew install libpq && brew link --force libpq`
  - Ubuntu/Debian: `sudo apt install postgresql-client`
  - Windows: install from [postgresql.org](https://www.postgresql.org/download/windows/)

## 1. Create a Neon project
1. Go to [console.neon.tech](https://console.neon.tech) and sign up / log in (GitHub/Google works).
2. Click **New Project**.
3. Name it `appraisal-bot`, pick the nearest region (e.g., AWS `ap-south-1` for Bengaluru), Postgres 16.
4. Click **Create Project**.

## 2. Grab the connection string
- On the project dashboard, copy the **Connection string** (it looks like):
  ```
  postgresql://<user>:<password>@ep-xxxx-xxxx.ap-south-1.aws.neon.tech/neondb?sslmode=require
  ```
- Save it as an env var so you don't keep pasting it:
  ```bash
  export DATABASE_URL="postgresql://<user>:<password>@ep-xxxx-xxxx.ap-south-1.aws.neon.tech/neondb?sslmode=require"
  ```

## 3. Apply schema
```bash
psql "$DATABASE_URL" -f db/schema.sql
```

## 4. Load seed data
```bash
psql "$DATABASE_URL" -f db/seed.sql
```

## 5. Verify
```bash
psql "$DATABASE_URL" -c "\dt"
psql "$DATABASE_URL" -c "SELECT name, role FROM employees;"
```

You can also use the **SQL Editor** inside the Neon console to run the same scripts — just paste the contents of `schema.sql`, run, then paste `seed.sql`, run.

## Using this in the backend later
Put the same connection string into your backend `.env`:
```
DATABASE_URL=postgresql://<user>:<password>@ep-xxxx-xxxx.ap-south-1.aws.neon.tech/neondb?sslmode=require
```
The Node.js `pg` client respects `sslmode=require` automatically.

## Reset / Re-seed
Both scripts are idempotent — re-running `schema.sql` drops and recreates tables, then `seed.sql` re-inserts.

## Notes
- Neon auto-suspends compute when idle; first query after idle takes ~1s to wake up (fine for dev).
- Free tier gives 0.5 GB storage + 1 branch — plenty for this project.
- You can create a `dev` branch in Neon for safe schema experiments later.
