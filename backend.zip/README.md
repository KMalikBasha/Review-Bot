# Appraisal Bot — Backend

Node.js + Express: REST API + Microsoft Teams bot + Slack bot + nudge scheduler, all in one service.

## Setup

```bash
cd backend
npm install
cp .env.example .env
# Fill in DATABASE_URL, Slack creds (SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET)
# Teams creds optional if you only want Slack
```

Run migrations (one-time, in order):
```bash
psql "$DATABASE_URL" -f ../db/schema.sql
psql "$DATABASE_URL" -f ../db/seed.sql
psql "$DATABASE_URL" -f ../db/03_bot_tables.sql
psql "$DATABASE_URL" -f ../db/04_slack_support.sql
```

Start:
```bash
npm run dev
```

## Slack setup

### 1. App config (in api.slack.com/apps)
You already have **Bot Token** + **Signing Secret**. In your Slack app settings:

- **OAuth & Permissions → Bot Token Scopes** (minimum needed):
  - `chat:write` — send DMs
  - `im:write` — open DM channels
  - `im:history` — receive DMs
  - `app_mentions:read` — optional, for @mentions in channels
  - `users:read` — look up user info
- **Event Subscriptions → Enable**
  - Request URL: `https://<your-ngrok>/slack/events`
  - Subscribe to bot events: `message.im`, `app_home_opened`, `app_mention` (optional)
- **Interactivity & Shortcuts → Enable**
  - Request URL: `https://<your-ngrok>/slack/events`
- **Install / Reinstall** the app to your workspace after changing scopes

### 2. Expose local backend to Slack
```bash
ngrok http 4000
```
Paste the HTTPS URL into the Request URLs above.

### 3. Map Slack users to employees
Get a Slack user ID (starts with `U...`): click a user's profile in Slack → ⋯ → **Copy member ID**.

```sql
UPDATE employees SET slack_user_id = 'U01ABCD1234' WHERE id = 5;
```

### 4. DM the bot at least once
Open a DM with the bot, send `hi`. This fires `app_home_opened` / `message.im` and caches the DM channel in `slack_conversation_refs`. You can also skip this — the proactive helper will open a DM on demand.

## Teams setup
See earlier sections — unchanged. The scheduler picks Slack if `slack_user_id` is set, otherwise Teams.

## API

| Method | Path                                   | Purpose                                   |
|--------|----------------------------------------|-------------------------------------------|
| GET    | `/health`                              | Health check                              |
| ...    | `/api/...`                             | HR admin CRUD (unchanged)                 |
| POST   | `/api/messages`                        | Teams bot endpoint                        |
| POST   | `/slack/events`                        | Slack events + interactivity              |
| POST   | `/api/admin/run-nudges`                | Force a scheduler pass                    |
| POST   | `/api/admin/send-teams-message`        | `{ teams_user_id, text }`                 |
| POST   | `/api/admin/send-slack-message`        | `{ slack_user_id, text }`                 |

## How the scheduler picks a channel
For each target user (employee / manager / DH / HR):
1. If `slack_user_id` set → send via Slack
2. Else if `teams_user_id` set → send via Teams
3. Else log `no_messaging_id` in `nudge_log`

This lets you migrate users gradually.

## Quick Slack-only test
```bash
# 1. DM the bot `hi` — should get back the help card
# 2. In DB: UPDATE employees SET slack_user_id='Uxxxx' WHERE id=5;
# 3. Clear Arjun's responses so he becomes pending:
#    DELETE FROM employee_responses WHERE review_cycle_id=1 AND employee_id=5;
# 4. Fire the scheduler:
curl -X POST http://localhost:4000/api/admin/run-nudges
# 5. Check Slack — you should get the nudge DM
```