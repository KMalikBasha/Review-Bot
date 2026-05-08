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
const goalTemplatesRouter  = require('./routes/goalTemplates');
const goalsRouter          = require('./routes/goals');

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
app.use('/api/goal-templates', goalTemplatesRouter);
app.use('/api/goals',          goalsRouter);

// --- Teams bot endpoint ---
app.post('/api/messages', (req, res) => {
  adapter.process(req, res, (context) => bot.run(context));
});

// --- Dev / admin helpers ---
app.post('/api/admin/run-nudges', async (_req, res, next) => {
  try { await runNudges(); res.json({ ok: true }); }
  catch (e) { next(e); }
});

// Clear nudge log so a person can be re-nudged immediately (useful after resetting test data).
// Body: { employee_id?, cycle_id?, stage? }  — all optional; omitting all clears everything.
app.post('/api/admin/clear-nudge-log', async (req, res, next) => {
  const db = require('./db');
  try {
    const { employee_id, cycle_id, stage } = req.body || {};
    const conditions = [];
    const params = [];
    if (employee_id) { params.push(employee_id); conditions.push(`employee_id = $${params.length}`); }
    if (cycle_id)    { params.push(cycle_id);    conditions.push(`review_cycle_id = $${params.length}`); }
    if (stage)       { params.push(stage);       conditions.push(`stage = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(`DELETE FROM nudge_log ${where}`, params);
    res.json({ ok: true, deleted: result.rowCount });
  } catch (e) { next(e); }
});

app.post('/api/admin/clear-sessions', async (_req, res, next) => {
  const db = require('./db');
  try {
    const result = await db.query('DELETE FROM flow_sessions');
    res.json({ ok: true, deleted: result.rowCount });
  } catch (e) { next(e); }
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