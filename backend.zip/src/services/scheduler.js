const cron = require('node-cron');
const db = require('../db');
const { sendProactiveMessage }       = require('../bot/proactive');
const { sendSlackProactiveMessage }  = require('../slack/proactive');

async function sendTo(user, message) {
  if (user.slack_user_id) {
    return sendSlackProactiveMessage(user.slack_user_id, message);
  }
  if (user.teams_user_id) {
    return sendProactiveMessage(user.teams_user_id, message);
  }
  return { ok: false, reason: 'no_messaging_id' };
}

// ── Non-manager nudge (employee / delivery_head / HR) ─────────────────────
function nudgeMessage(stage, cycleName, employeeName) {
  const text = (() => {
    switch (stage) {
      case 'employee':
        return `Reminder -- please complete your appraisal questionnaire for *${cycleName}*.`;
      case 'delivery_head':
        return `Reminder -- the manager feedback for *${employeeName}* (${cycleName}) is ready for your review.`;
      case 'hr':
        return `Reminder -- *${employeeName}* is ready for your final summary in *${cycleName}*.`;
      default:
        return `Reminder -- you have a pending action in ${cycleName}.`;
    }
  })();

  return {
    text,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text } },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Start' },
            style: 'primary',
            action_id: 'start_appraisal',
          },
        ],
      },
    ],
  };
}

// ── Manager digest card ───────────────────────────────────────────────────
function managerDigestMessage(cycleName, allEmployees, endDate) {
  const total      = allEmployees.length;
  const reviewed   = allEmployees.filter(e => e.manager_status === 'submitted').length;
  const pending    = allEmployees.filter(
    e => e.employee_status === 'submitted' && e.manager_status !== 'submitted'
  ).length;
  const notStarted = allEmployees.filter(e => e.employee_status !== 'submitted').length;
  const percent    = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  const daysLeft = endDate ? Math.ceil((new Date(endDate) - Date.now()) / 86400000) : null;
  const daysLabel = daysLeft === null ? null
    : daysLeft > 0  ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
    : daysLeft === 0 ? 'Due today'
    : `${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} overdue`;

  const fallback = `Review digest for ${cycleName}: ${pending} pending, ${reviewed}/${total} reviewed.`;

  // ── Slack Block Kit ──────────────────────────────────────────────────────
  const filled = Math.round((percent / 100) * 10);
  const bar    = ':large_purple_square:'.repeat(filled) + ':white_large_square:'.repeat(10 - filled);

  const slackEmployeeBlocks = allEmployees.map((emp) => {
    const isDone    = emp.manager_status === 'submitted';
    const isPending = !isDone && emp.employee_status === 'submitted';
    const icon  = isDone ? ':white_check_mark:' : isPending ? ':hourglass_flowing_sand:' : ':red_circle:';
    const label = isDone ? '~Reviewed~' : isPending ? '*Awaiting your review*' : '_Not started yet_';
    const block = { type: 'section', text: { type: 'mrkdwn', text: `${icon}  *${emp.name}*    ${label}` } };
    if (isPending) {
      block.accessory = {
        type: 'button',
        text: { type: 'plain_text', text: 'Review', emoji: true },
        style: 'primary', action_id: 'start_appraisal',
      };
    }
    return block;
  });

  const slackBlocks = [
    { type: 'header', text: { type: 'plain_text', text: `📋  ${cycleName}`, emoji: true } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: daysLabel ? `:clock1:  *${daysLabel}*` : `:calendar:  *Appraisal in progress*` },
        { type: 'mrkdwn', text: `:bell:  *${pending} teammate${pending !== 1 ? 's' : ''} need${pending === 1 ? 's' : ''} a nudge*` },
      ],
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Start Reviews', emoji: true },
        style: 'primary', action_id: 'start_appraisal',
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Overall Progress*\n${bar}  *${percent}%*` },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `:white_check_mark: *${reviewed} reviewed*   :hourglass_flowing_sand: *${pending} pending*   :red_circle: *${notStarted} not started*` },
      ],
    },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: '*👥  Team Status*' } },
    ...slackEmployeeBlocks,
    { type: 'divider' },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `_Tap *Review* next to an employee or *Start Reviews* to begin._` }],
    },
  ];

  // ── Teams Adaptive Card ──────────────────────────────────────────────────
  const teamsEmployeeRows = allEmployees.map((emp) => {
    const isDone    = emp.manager_status === 'submitted';
    const isPending = !isDone && emp.employee_status === 'submitted';
    const statusText  = isDone ? '✅ Reviewed' : isPending ? '⏳ Awaiting review' : '🔴 Not started';
    const statusColor = isDone ? 'good' : isPending ? 'warning' : 'attention';

    const cols = [
      {
        type: 'Column', width: 'stretch',
        items: [{ type: 'TextBlock', text: `**${emp.name}**`, size: 'small', wrap: false }],
        verticalContentAlignment: 'center',
      },
      {
        type: 'Column', width: 'auto',
        items: [{ type: 'TextBlock', text: statusText, color: statusColor, size: 'small', wrap: false }],
        verticalContentAlignment: 'center',
      },
    ];

    if (isPending) {
      cols.push({
        type: 'Column', width: 'auto',
        items: [{
          type: 'ActionSet',
          actions: [{
            type: 'Action.Submit', title: 'Review', style: 'positive',
            data: { action: 'start_appraisal', employee_id: emp.id },
          }],
        }],
        verticalContentAlignment: 'center',
      });
    }

    return { type: 'ColumnSet', columns: cols, separator: true, spacing: 'small' };
  });

  const teamsCard = {
    contentType: 'application/vnd.microsoft.card.adaptive',
    content: {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        // ── Header ─────────────────────────────────────────────────────────
        {
          type: 'Container', style: 'accent', bleed: true,
          items: [{
            type: 'ColumnSet',
            columns: [
              {
                type: 'Column', width: 'stretch',
                items: [
                  { type: 'TextBlock', text: `📋 ${cycleName}`, weight: 'bolder', size: 'medium', color: 'light' },
                  ...(daysLabel ? [{ type: 'TextBlock', text: `⏰ ${daysLabel}`, size: 'small', color: 'light', spacing: 'none', isSubtle: true }] : []),
                ],
              },
              ...(pending > 0 ? [{
                type: 'Column', width: 'auto', verticalContentAlignment: 'center',
                items: [{ type: 'TextBlock', text: `🔔 ${pending} need a nudge`, color: 'light', size: 'small', weight: 'bolder', wrap: false }],
              }] : []),
            ],
          }],
        },
        // ── Progress ────────────────────────────────────────────────────────
        {
          type: 'Container', spacing: 'medium',
          items: [
            {
              type: 'ColumnSet', spacing: 'none',
              columns: [
                { type: 'Column', width: 'stretch', items: [{ type: 'TextBlock', text: '**Overall Progress**', weight: 'bolder', size: 'small' }] },
                { type: 'Column', width: 'auto',    items: [{ type: 'TextBlock', text: `**${percent}%**`,      weight: 'bolder', color: 'accent', size: 'small' }] },
              ],
            },
            // Progress bar via two-column containers
            {
              type: 'ColumnSet', spacing: 'small',
              columns: [
                ...(percent > 0 ? [{
                  type: 'Column', width: String(percent), style: 'accent', bleed: true,
                  items: [{ type: 'TextBlock', text: ' ', size: 'small' }],
                }] : []),
                ...(percent < 100 ? [{
                  type: 'Column', width: String(100 - percent), style: 'emphasis', bleed: true,
                  items: [{ type: 'TextBlock', text: ' ', size: 'small' }],
                }] : []),
              ],
            },
            {
              type: 'ColumnSet', spacing: 'small',
              columns: [
                { type: 'Column', width: 'auto', items: [{ type: 'TextBlock', text: `✅ ${reviewed} reviewed`,   color: 'good',      size: 'small' }] },
                { type: 'Column', width: 'auto', items: [{ type: 'TextBlock', text: `⏳ ${pending} pending`,     color: 'warning',   size: 'small' }] },
                { type: 'Column', width: 'auto', items: [{ type: 'TextBlock', text: `🔴 ${notStarted} not started`, color: 'attention', size: 'small' }] },
              ],
            },
          ],
        },
        // ── Team Status ──────────────────────────────────────────────────────
        { type: 'TextBlock', text: '**👥 Team Status**', weight: 'bolder', separator: true, spacing: 'medium' },
        ...teamsEmployeeRows,
        // ── Footer ──────────────────────────────────────────────────────────
        { type: 'TextBlock', text: '_Tap Review next to an employee or Start Reviews to begin._', isSubtle: true, size: 'small', wrap: true, separator: true, spacing: 'medium' },
      ],
      actions: [
        { type: 'Action.Submit', title: '👁 View Team',     style: 'positive', data: { action: 'view_team',       cycleName } },
        { type: 'Action.Submit', title: '🔔 Send Reminder',                    data: { action: 'send_reminder',   cycleName } },
      ],
    },
  };

  // Wrap Slack blocks in an attachment so Slack renders a bordered card
  const slackAttachments = [{ color: '#5C3EE8', blocks: slackBlocks }];

  return { text: fallback, attachments: slackAttachments, card: teamsCard };
}

async function wasRecentlyNudged(cycleId, employeeId, stage, intervalDays) {
  const { rows } = await db.query(
    `SELECT 1 FROM nudge_log
      WHERE review_cycle_id = $1
        AND employee_id = $2
        AND stage = $3
        AND sent_at > NOW() - ($4 || ' days')::interval
      LIMIT 1`,
    [cycleId, employeeId, stage, intervalDays]
  );
  return rows.length > 0;
}

async function logNudge(cycleId, employeeId, stage, result) {
  await db.query(
    `INSERT INTO nudge_log (review_cycle_id, employee_id, stage, delivered, error_message)
     VALUES ($1, $2, $3, $4, $5)`,
    [cycleId, employeeId, stage, result.ok, result.ok ? null : result.reason]
  );
}

// ── Send ONE digest card per manager ──────────────────────────────────────
async function sendManagerDigests(cycle, emps) {
  const intervalDays = cycle.manager_notify_interval_days;

  // Group ALL employees by their manager
  const managerMap = new Map();
  for (const emp of emps) {
    const mgrKey = emp.manager_slack_id || emp.manager_teams_id;
    if (!mgrKey) continue;
    if (!managerMap.has(mgrKey)) {
      managerMap.set(mgrKey, {
        slack_id: emp.manager_slack_id,
        teams_id: emp.manager_teams_id,
        employees: [],
      });
    }
    managerMap.get(mgrKey).employees.push(emp);
  }

  for (const [, mgr] of managerMap) {
    const pendingEmployees = mgr.employees.filter(
      e => e.employee_status === 'submitted' && e.manager_status !== 'submitted'
    );
    if (!pendingEmployees.length) continue;

    const dueEmployees = pendingEmployees;

    // Send ONE card showing all employees under this manager
    const target = { slack_user_id: mgr.slack_id, teams_user_id: mgr.teams_id };
    const result = await sendTo(target, managerDigestMessage(cycle.name, mgr.employees, cycle.end_date));

    // Log a nudge entry for each employee that was due
    for (const emp of dueEmployees) {
      await logNudge(cycle.id, emp.id, 'manager', result);
    }

    console.log(`[nudge] manager digest sent (${dueEmployees.length} due) -> ${mgr.slack_id || mgr.teams_id}`);
  }
}

// ── Per-employee stages: employee / delivery_head / HR ────────────────────
async function processEmployeeForCycle(cycle, empRow, sentThisPass = new Set()) {
  const {
    id: cycleId, name: cycleName,
    employee_notify_interval_days:      empInt,
    delivery_head_notify_interval_days: dhInt,
  } = cycle;

  const key = (target) => target.slack_user_id || target.teams_user_id || null;

  // Stage 1: employee self-review
  if (empRow.employee_status !== 'submitted') {
    const target = { slack_user_id: empRow.slack_user_id, teams_user_id: empRow.teams_user_id };
    const k = key(target);
    if (!k) return;
    if (sentThisPass.has(k)) return;
    const result = await sendTo(target, nudgeMessage('employee', cycleName, empRow.name));
    await logNudge(cycleId, empRow.id, 'employee', result);
    if (result.ok) sentThisPass.add(k);
    return;
  }

  // Stage 2: manager -- handled by sendManagerDigests, skip here
  if (empRow.manager_status !== 'submitted') return;

  // Stage 3: delivery head
  if (empRow.delivery_head_status !== 'submitted') {
    const target = { slack_user_id: empRow.delivery_head_slack_id, teams_user_id: empRow.delivery_head_teams_id };
    const k = key(target);
    if (!k) return;
    if (sentThisPass.has(k)) return;
    const result = await sendTo(target, nudgeMessage('delivery_head', cycleName, empRow.name));
    await logNudge(cycleId, empRow.id, 'delivery_head', result);
    if (result.ok) sentThisPass.add(k);
    return;
  }

  // Stage 4: HR
  if (empRow.hr_status !== 'submitted') {
    const { rows: hrRows } = await db.query(
      `SELECT id, teams_user_id, slack_user_id FROM employees
        WHERE role = 'hr' AND is_active = TRUE
          AND (teams_user_id IS NOT NULL OR slack_user_id IS NOT NULL)
        LIMIT 1`
    );
    if (!hrRows.length) return;
    const target = hrRows[0];
    const k = key(target);
    if (sentThisPass.has(k)) return;
    const result = await sendTo(target, nudgeMessage('hr', cycleName, empRow.name));
    await logNudge(cycleId, empRow.id, 'hr', result);
    if (result.ok) sentThisPass.add(k);
  }
}

// ── Sync check-in period statuses (upcoming → active → closed) ───────────────
async function syncCheckinPeriodStatuses() {
  const today = new Date().toISOString().slice(0, 10);
  await db.query(
    `UPDATE checkin_periods SET status = 'active'
     WHERE status = 'upcoming' AND period_start <= $1 AND period_end >= $1`,
    [today]
  );
  await db.query(
    `UPDATE checkin_periods SET status = 'closed'
     WHERE status IN ('upcoming', 'active') AND period_end < $1`,
    [today]
  );
}

// ── Auto-generate quarterly reviews for ended quarters ───────────────────────
async function generateQuarterlyReviews() {
  const { summarizeCheckinsForQuarterlyReview } = require('./ai');
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // All calendar quarters that have fully passed up to today
  const quarters = [];
  for (let y = today.getFullYear() - 1; y <= today.getFullYear(); y++) {
    [[1, '01-01', '03-31'], [2, '04-01', '06-30'], [3, '07-01', '09-30'], [4, '10-01', '12-31']]
      .forEach(([q, qs, qe]) => {
        const qEnd = `${y}-${qe}`;
        if (qEnd <= todayStr) quarters.push({ label: `Q${q} ${y}`, start: `${y}-${qs}`, end: qEnd });
      });
  }
  if (!quarters.length) return;

  const { rows: cycles } = await db.query(`SELECT * FROM review_cycles WHERE status = 'active'`);
  for (const cycle of cycles) {
    // Only employees assigned to this cycle
    const { rows: employees } = await db.query(
      `SELECT DISTINCT e.id, e.name, m.id AS manager_id, m.slack_user_id AS manager_slack_id, m.teams_user_id AS manager_teams_id
       FROM employees e
       JOIN employee_cycle_assignments eca ON eca.employee_id = e.id AND eca.review_cycle_id = $1
       LEFT JOIN employees m ON m.id = e.manager_id
       WHERE e.role = 'employee' AND e.is_active = TRUE`,
      [cycle.id]
    );

    for (const quarter of quarters) {
      // Skip if quarter doesn't overlap cycle dates
      if (quarter.end < cycle.start_date || quarter.start > cycle.end_date) continue;

      for (const emp of employees) {
        // Skip if quarterly review already exists
        const { rows: existing } = await db.query(
          `SELECT 1 FROM quarterly_reviews
           WHERE review_cycle_id = $1 AND employee_id = $2 AND quarter_label = $3`,
          [cycle.id, emp.id, quarter.label]
        );
        if (existing.length) continue;

        // Count check-ins for this employee in the quarter
        const { rows: ciRows } = await db.query(
          `SELECT cr.response_text, q.question_text, q.question_order, cp.period_label
           FROM checkin_responses cr
           JOIN checkin_periods   cp ON cp.id = cr.checkin_period_id
           JOIN questionnaires    q  ON q.id  = cr.question_id
           WHERE cr.employee_id = $1
             AND cp.review_cycle_id = $2
             AND cp.period_start >= $3
             AND cp.period_end   <= $4
           ORDER BY cp.period_number, q.question_order`,
          [emp.id, cycle.id, quarter.start, quarter.end]
        );

        // Only create a quarterly review if there are actual check-ins
        if (!ciRows.length) continue;

        // Generate AI summary
        let aiSummary = null;
        try {
          aiSummary = await summarizeCheckinsForQuarterlyReview(emp, ciRows, quarter.label);
        } catch (err) {
          console.error(`[quarterly] AI summary failed for emp ${emp.id}`, err.message);
        }

        await db.query(
          `INSERT INTO quarterly_reviews
             (review_cycle_id, employee_id, quarter_label, quarter_start, quarter_end,
              checkin_count, ai_summary, manager_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
          [cycle.id, emp.id, quarter.label, quarter.start, quarter.end,
           ciRows.length, aiSummary, emp.manager_id]
        );

        console.log(`[quarterly] created review for emp ${emp.id} ${quarter.label} (${ciRows.length} check-ins)`);

        // Notify manager
        if (emp.manager_id) {
          const target = { slack_user_id: emp.manager_slack_id, teams_user_id: emp.manager_teams_id };
          const msg = {
            text: `Quarterly review ready: ${emp.name} — ${quarter.label}`,
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: `📊 Quarterly Review Ready`, emoji: true } },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*${emp.name}* has completed *${ciRows.length} check-in${ciRows.length !== 1 ? 's' : ''}* in *${quarter.label}*.\nTheir quarterly review is ready for your feedback.`,
                },
                accessory: {
                  type: 'button',
                  text: { type: 'plain_text', text: 'Review Now', emoji: true },
                  style: 'primary',
                  action_id: 'start_appraisal',
                },
              },
            ],
          };
          try { await sendTo(target, msg); } catch (e) { /* non-fatal */ }
        }
      }
    }
  }
}

// ── Nudge for active check-in period ─────────────────────────────────────────
async function nudgeForActivePeriod(cycle, emp, sentThisPass) {
  const today = new Date().toISOString().slice(0, 10);
  const { rows: periods } = await db.query(
    `SELECT * FROM checkin_periods
     WHERE review_cycle_id = $1 AND status = 'active' AND period_end >= $2
     ORDER BY period_start LIMIT 1`,
    [cycle.id, today]
  );
  if (!periods.length) return;
  const period = periods[0];

  // Check if employee already responded to this period
  const { rows: done } = await db.query(
    `SELECT COUNT(*) AS cnt FROM checkin_responses WHERE checkin_period_id = $1 AND employee_id = $2`,
    [period.id, emp.id]
  );
  if (parseInt(done[0].cnt, 10) > 0) return;

  const key = (t) => t.slack_user_id || t.teams_user_id || null;
  const target = { slack_user_id: emp.slack_user_id, teams_user_id: emp.teams_user_id };
  const k = key(target);
  if (!k || sentThisPass.has(k)) return;

  const alreadyNudged = await wasRecentlyNudged(cycle.id, emp.id, 'checkin_period', cycle.employee_notify_interval_days);
  if (alreadyNudged) return;

  const msg = {
    text: `Check-in reminder: ${period.period_label} for ${cycle.name}`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `📝 Check-In Reminder`, emoji: true } },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `It's time for your *${period.period_label}* check-in for *${cycle.name}*.\nDeadline: *${period.period_end}*`,
        },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Start Check-In', emoji: true },
          style: 'primary',
          action_id: 'start_appraisal',
        },
      },
    ],
  };
  const result = await sendTo(target, msg);
  await logNudge(cycle.id, emp.id, 'checkin_period', result);
  if (result.ok) sentThisPass.add(k);
}

async function runNudges() {
  console.log('[nudge] running scheduler pass', new Date().toISOString());
  try {
    // Sync check-in period statuses first
    await syncCheckinPeriodStatuses();

    // Auto-generate quarterly reviews for ended quarters
    await generateQuarterlyReviews();

    const { rows: cycles } = await db.query(
      `SELECT * FROM review_cycles WHERE status = 'active'`
    );
    if (!cycles.length) { console.log('[nudge] no active cycles'); return; }

    const sentThisPass = new Set();

    for (const cycle of cycles) {
      const { rows: emps } = await db.query(
        `
        WITH emp_resp AS (
          SELECT employee_id, COUNT(*) AS answered
          FROM employee_responses
          WHERE review_cycle_id = $1
          GROUP BY employee_id
        ),
        total_q AS (
          SELECT e.id AS employee_id, COUNT(q.id) AS total
          FROM employees e
          LEFT JOIN questionnaires q
            ON q.category_id = e.category_id AND q.is_active = TRUE
          WHERE e.role = 'employee'
          GROUP BY e.id
        )
        SELECT
          e.id, e.name,
          e.teams_user_id, e.slack_user_id,
          m.teams_user_id AS manager_teams_id,
          m.slack_user_id AS manager_slack_id,
          d.teams_user_id AS delivery_head_teams_id,
          d.slack_user_id AS delivery_head_slack_id,
          CASE WHEN er.answered IS NOT NULL AND er.answered >= tq.total AND tq.total > 0
               THEN 'submitted' ELSE 'pending' END AS employee_status,
          CASE WHEN mf.id IS NOT NULL THEN 'submitted' ELSE 'pending' END AS manager_status,
          CASE WHEN dh.id IS NOT NULL THEN 'submitted' ELSE 'pending' END AS delivery_head_status,
          CASE WHEN fs.id IS NOT NULL THEN 'submitted' ELSE 'pending' END AS hr_status
        FROM employees e
        -- Only include employees explicitly assigned to this cycle
        JOIN employee_cycle_assignments eca
          ON eca.employee_id = e.id AND eca.review_cycle_id = $1
        LEFT JOIN employees m           ON m.id = e.manager_id
        LEFT JOIN employees d           ON d.id = e.delivery_head_id
        LEFT JOIN emp_resp er           ON er.employee_id = e.id
        LEFT JOIN total_q  tq           ON tq.employee_id = e.id
        LEFT JOIN manager_feedback      mf ON mf.employee_id = e.id AND mf.review_cycle_id = $1
        LEFT JOIN delivery_head_reviews dh ON dh.employee_id = e.id AND dh.review_cycle_id = $1
        LEFT JOIN final_summaries       fs ON fs.employee_id = e.id AND fs.review_cycle_id = $1
        WHERE e.is_active = TRUE
        `,
        [cycle.id]
      );

      // Nudge employees for active check-in period
      for (const emp of emps) {
        try { await nudgeForActivePeriod(cycle, emp, sentThisPass); }
        catch (err) { console.error(`[nudge] checkin period nudge failed emp ${emp.id}`, err); }
      }

      // ONE digest card per manager
      await sendManagerDigests(cycle, emps);

      // Individual nudges for employee / DH / HR stages
      for (const emp of emps) {
        try { await processEmployeeForCycle(cycle, emp, sentThisPass); }
        catch (err) { console.error(`[nudge] employee ${emp.id} failed`, err); }
      }
    }
  } catch (err) {
    console.error('[nudge] scheduler pass failed', err);
  }
}

function startScheduler() {
  const expr = process.env.NUDGE_CRON || '0 9 * * *';
  cron.schedule(expr, runNudges);
  console.log(`[nudge] scheduler started with cron: "${expr}"`);

  if (process.env.NUDGE_RUN_ON_STARTUP === 'true') {
    console.log('[nudge] NUDGE_RUN_ON_STARTUP=true -- running once now');
    runNudges();
  }
}

module.exports = { startScheduler, runNudges };
