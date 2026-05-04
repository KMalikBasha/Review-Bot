const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { sendSlackProactiveMessage } = require('../slack/proactive');
const { sendProactiveMessage }      = require('../bot/proactive');

async function sendTo(user, msg) {
  if (user.slack_user_id) return sendSlackProactiveMessage(user.slack_user_id, msg);
  if (user.teams_user_id) return sendProactiveMessage(user.teams_user_id, msg);
  return { ok: false, reason: 'no_messaging_id' };
}

// GET /api/assignments/cycle/:cycleId — list all assignments for a cycle
router.get('/cycle/:cycleId', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT a.id, a.employee_id, a.review_cycle_id, a.assigned_at, a.prompt_sent,
              e.name AS employee_name, e.slack_user_id, e.teams_user_id,
              ab.name AS assigned_by_name
       FROM employee_cycle_assignments a
       JOIN  employees e  ON e.id  = a.employee_id
       LEFT JOIN employees ab ON ab.id = a.assigned_by
       WHERE a.review_cycle_id = $1
       ORDER BY e.name`,
      [req.params.cycleId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/assignments/active — map of employee_id → current active cycle for the whole org
router.get('/active', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT a.employee_id, rc.id AS cycle_id, rc.name AS cycle_name
       FROM employee_cycle_assignments a
       JOIN review_cycles rc ON rc.id = a.review_cycle_id
       WHERE rc.status IN ('draft', 'active')`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/assignments — assign an employee to a cycle and send them a bot prompt
router.post('/', async (req, res, next) => {
  try {
    const { employee_id, review_cycle_id, assigned_by } = req.body;
    if (!employee_id || !review_cycle_id)
      return res.status(400).json({ error: 'employee_id and review_cycle_id required' });

    // Block if employee is already assigned to a different active/draft cycle.
    // Each employee may only belong to one review cycle at a time.
    const { rows: conflict } = await db.query(
      `SELECT rc.name AS cycle_name
       FROM employee_cycle_assignments a
       JOIN review_cycles rc ON rc.id = a.review_cycle_id
       WHERE a.employee_id = $1
         AND rc.status IN ('draft', 'active')
         AND rc.id != $2
       LIMIT 1`,
      [employee_id, review_cycle_id]
    );
    if (conflict.length) {
      return res.status(409).json({
        error: `This employee is already assigned to the "${conflict[0].cycle_name}" review cycle. Remove them from that cycle first.`,
      });
    }

    // Upsert so re-assigning the same employee is idempotent
    const { rows } = await db.query(
      `INSERT INTO employee_cycle_assignments (employee_id, review_cycle_id, assigned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (employee_id, review_cycle_id)
       DO UPDATE SET assigned_by = EXCLUDED.assigned_by
       RETURNING *`,
      [employee_id, review_cycle_id, assigned_by || null]
    );
    const assignment = rows[0];

    // Fetch employee + cycle name for the prompt message
    const { rows: empRows } = await db.query(
      `SELECT e.*, rc.name AS cycle_name
       FROM employees e
       JOIN review_cycles rc ON rc.id = $2
       WHERE e.id = $1`,
      [employee_id, review_cycle_id]
    );
    const emp = empRows[0];

    // Send bot prompt immediately on assignment
    if (emp && (emp.slack_user_id || emp.teams_user_id)) {
      const msg = {
        text: `You have been assigned to the *${emp.cycle_name}* appraisal cycle. Please complete your self-review.`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '📋 Self-Review Assigned', emoji: true },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `You have been assigned to the *${emp.cycle_name}* appraisal cycle.\n\nPlease complete your self-review at your earliest convenience.`,
            },
            accessory: {
              type: 'button',
              text: { type: 'plain_text', text: 'Start Self-Review', emoji: true },
              style: 'primary',
              action_id: 'start_appraisal',
            },
          },
        ],
      };
      try {
        const result = await sendTo(emp, msg);
        if (result.ok) {
          await db.query(
            `UPDATE employee_cycle_assignments SET prompt_sent = TRUE WHERE id = $1`,
            [assignment.id]
          );
          assignment.prompt_sent = true;
        }
      } catch (_e) { /* prompt failure is non-fatal — assignment is still recorded */ }
    }

    res.status(201).json({ ...assignment, employee_name: emp ? emp.name : null });
  } catch (err) { next(err); }
});

// DELETE /api/assignments/:id — remove an assignment
router.delete('/:id', async (req, res, next) => {
  try {
    await db.query(`DELETE FROM employee_cycle_assignments WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
