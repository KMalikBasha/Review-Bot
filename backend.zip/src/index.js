require('dotenv').config();

const express = require('express');
const cors = require('cors');

const categoriesRouter     = require('./routes/categories');
const questionnairesRouter = require('./routes/questionnaires');
const employeesRouter      = require('./routes/employees');
const cyclesRouter         = require('./routes/cycles');
const reviewsRouter        = require('./routes/reviews');
const checkinsRouter       = require('./routes/checkins');
const quarterlyRouter      = require('./routes/quarterly');
const assignmentsRouter    = require('./routes/assignments');

// Teams bot
const { adapter } = require('./bot/adapter');
const { AppraisalBot } = require('./bot/bot');
const { sendProactiveMessage } = require('./bot/proactive');

// Slack bot
const { receiver: slackReceiver } = require('./slack/app');
const { sendSlackProactiveMessage } = require('./slack/proactive');

// Scheduler
const { startScheduler, runNudges } = require('./services/scheduler');

const bot = new AppraisalBot();
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

// NOTE on body parsing:
// Slack's ExpressReceiver handles its own body parsing for signed requests.
// If we attach express.json() BEFORE mounting Slack, it consumes the body
// and breaks signature verification. So we mount Slack FIRST, then json().
app.use(slackReceiver.app);     // mounts POST /slack/events

app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// --- REST API routes ---
app.use('/api/categories',     categoriesRouter);
app.use('/api/questionnaires', questionnairesRouter);
app.use('/api/employees',      employeesRouter);
app.use('/api/cycles',         cyclesRouter);
app.use('/api/reviews',        reviewsRouter);
app.use('/api/checkins',       checkinsRouter);
app.use('/api/quarterly',      quarterlyRouter);
app.use('/api/assignments',    assignmentsRouter);

// --- Teams bot endpoint ---
app.post('/api/messages', (req, res) => {
  adapter.process(req, res, (context) => bot.run(context));
});

// --- Dev / admin helpers ---
app.post('/api/admin/run-nudges', async (_req, res, next) => {
  try { await runNudges(); res.json({ ok: true }); }
  catch (e) { next(e); }
});

app.post('/api/admin/send-teams-message', async (req, res, next) => {
  try {
    const { teams_user_id, text } = req.body;
    if (!teams_user_id || !text) return res.status(400).json({ error: 'teams_user_id and text required' });
    res.json(await sendProactiveMessage(teams_user_id, text));
  } catch (e) { next(e); }
});

app.post('/api/admin/send-slack-message', async (req, res, next) => {
  try {
    const { slack_user_id, text } = req.body;
    if (!slack_user_id || !text) return res.status(400).json({ error: 'slack_user_id and text required' });
    res.json(await sendSlackProactiveMessage(slack_user_id, text));
  } catch (e) { next(e); }
});

// Central error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  console.log(`  Teams endpoint: /api/messages`);
  console.log(`  Slack endpoint: /slack/events`);
  startScheduler();
});