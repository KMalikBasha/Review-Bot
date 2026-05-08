const router = require('express').Router();
const db = require('../db');

// ── Helpers ───────────────────────────────────────────────────────────────────

// Validates that non-Values selected goals sum to exactly 100
// Returns null if valid, error string if not
function validateWeightageSum(goals) {
  const nonValues = goals.filter(g => g.objective_type !== 'Values');
  if (!nonValues.length) return 'At least one non-Values goal is required';
  const sum = nonValues.reduce((acc, g) => acc + Number(g.weightage || 0), 0);
  // Allow ±0.1 for floating-point rounding (e.g. 3.58 + 6×3.57 = 25.0)
  if (Math.abs(sum - 100) > 0.1) {
    return `Non-Values goal weightages must sum to 100 (currently ${sum.toFixed(2)})`;
  }
  return null;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/goals/cycle/:cycleId/employee/:employeeId
// Returns the employee's selected goals for a cycle, grouped by objective_type
router.get('/cycle/:cycleId/employee/:employeeId', async (req, res, next) => {
  try {
    const { cycleId, employeeId } = req.params;

    const { rows: goals } = await db.query(
      `SELECT g.*,
              t.role_name AS template_role
       FROM employee_goals g
       LEFT JOIN goal_templates t ON t.id = g.template_id
       WHERE g.cycle_id = $1 AND g.employee_id = $2
       ORDER BY g.objective_type, g.commitment, g.id`,
      [cycleId, employeeId]
    );

    // Fetch the assignment goals_status as well
    const { rows: [assignment] } = await db.query(
      `SELECT goals_status FROM employee_cycle_assignments
       WHERE review_cycle_id = $1 AND employee_id = $2`,
      [cycleId, employeeId]
    );

    res.json({
      goals_status: assignment?.goals_status || 'not_started',
      goals
    });
  } catch (e) { next(e); }
});

// GET /api/goals/cycle/:cycleId/employee/:employeeId/log
// Returns the approval audit trail for this employee's goals in this cycle
router.get('/cycle/:cycleId/employee/:employeeId/log', async (req, res, next) => {
  try {
    const { cycleId, employeeId } = req.params;
    const { rows } = await db.query(
      `SELECT l.*, e.name AS actor_name
       FROM goal_approval_log l
       LEFT JOIN employees e ON e.id = l.actor_id
       WHERE l.cycle_id = $1 AND l.employee_id = $2
       ORDER BY l.created_at DESC`,
      [cycleId, employeeId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/goals/cycle/:cycleId/employee/:employeeId
// Employee saves their selected goals (draft — does not submit yet)
// Body: { goals: [{ template_id, weightage, kra_title, ... , target_value, checkin_type }] }
router.post('/cycle/:cycleId/employee/:employeeId', async (req, res, next) => {
  try {
    const { cycleId, employeeId } = req.params;
    const { goals } = req.body;

    if (!Array.isArray(goals) || !goals.length) {
      return res.status(400).json({ error: 'goals array is required' });
    }

    // Validate assignment exists
    const { rows: [assignment] } = await db.query(
      `SELECT id, goals_status FROM employee_cycle_assignments
       WHERE review_cycle_id = $1 AND employee_id = $2`,
      [cycleId, employeeId]
    );
    if (!assignment) return res.status(404).json({ error: 'Employee not assigned to this cycle' });

    if (['hr_locked'].includes(assignment.goals_status)) {
      return res.status(400).json({ error: 'Goals are locked and cannot be edited' });
    }

    // Validate weightage sum
    const sumError = validateWeightageSum(goals);
    if (sumError) return res.status(400).json({ error: sumError });

    // Upsert goals (delete old drafts, insert new set)
    await db.query('BEGIN');
    try {
      // Only delete if still in draft/changes_requested state
      await db.query(
        `DELETE FROM employee_goals
         WHERE cycle_id = $1 AND employee_id = $2
           AND status IN ('draft','changes_requested')`,
        [cycleId, employeeId]
      );

      const insertedGoals = [];
      for (const g of goals) {
        const isValues = g.objective_type === 'Values';
        const { rows: [inserted] } = await db.query(
          `INSERT INTO employee_goals
             (cycle_id, employee_id, template_id, objective_type, area, commitment,
              weightage, kra_title, goal_description, goal_type, goal_performance,
              target_value, checkin_type, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft')
           RETURNING *`,
          [
            cycleId, employeeId,
            g.template_id || null,
            g.objective_type, g.area || null, g.commitment || null,
            isValues ? null : g.weightage,
            g.kra_title, g.goal_description || null,
            g.goal_type, g.goal_performance || 'The higher the better',
            g.target_value || null, g.checkin_type || null
          ]
        );
        insertedGoals.push(inserted);
      }

      // Update assignment goals_status to draft
      await db.query(
        `UPDATE employee_cycle_assignments SET goals_status = 'draft'
         WHERE review_cycle_id = $1 AND employee_id = $2`,
        [cycleId, employeeId]
      );

      await db.query('COMMIT');
      res.status(201).json({ ok: true, goals: insertedGoals });
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }
  } catch (e) { next(e); }
});

// POST /api/goals/cycle/:cycleId/employee/:employeeId/submit
// Employee submits goals for manager review
router.post('/cycle/:cycleId/employee/:employeeId/submit', async (req, res, next) => {
  try {
    const { cycleId, employeeId } = req.params;

    const { rows: goals } = await db.query(
      `SELECT * FROM employee_goals
       WHERE cycle_id = $1 AND employee_id = $2 AND status IN ('draft','changes_requested')`,
      [cycleId, employeeId]
    );
    if (!goals.length) return res.status(400).json({ error: 'No draft goals to submit' });

    const sumError = validateWeightageSum(goals);
    if (sumError) return res.status(400).json({ error: sumError });

    await db.query('BEGIN');
    try {
      await db.query(
        `UPDATE employee_goals SET status = 'submitted'
         WHERE cycle_id = $1 AND employee_id = $2 AND status IN ('draft','changes_requested')`,
        [cycleId, employeeId]
      );

      await db.query(
        `UPDATE employee_cycle_assignments SET goals_status = 'submitted'
         WHERE review_cycle_id = $1 AND employee_id = $2`,
        [cycleId, employeeId]
      );

      await db.query(
        `INSERT INTO goal_approval_log (cycle_id, employee_id, actor_id, action)
         VALUES ($1,$2,$2,'submitted')`,
        [cycleId, employeeId]
      );

      await db.query('COMMIT');
      res.json({ ok: true });
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }
  } catch (e) { next(e); }
});

// PUT /api/goals/cycle/:cycleId/employee/:employeeId/manager-review
// Manager approves, requests changes, or rejects employee goals
// Body: { action: 'manager_approved'|'changes_requested'|'rejected', actor_id, comment? }
router.put('/cycle/:cycleId/employee/:employeeId/manager-review', async (req, res, next) => {
  try {
    const { cycleId, employeeId } = req.params;
    const { action, actor_id, comment } = req.body;

    const VALID = ['manager_approved', 'changes_requested', 'rejected'];
    if (!VALID.includes(action)) {
      return res.status(400).json({ error: `action must be one of: ${VALID.join(', ')}` });
    }
    if (!actor_id) return res.status(400).json({ error: 'actor_id (manager employee id) is required' });
    if (action === 'changes_requested' && !comment) {
      return res.status(400).json({ error: 'comment is required when requesting changes' });
    }
    if (action === 'rejected' && !comment) {
      return res.status(400).json({ error: 'comment is required when rejecting' });
    }

    await db.query('BEGIN');
    try {
      await db.query(
        `UPDATE employee_goals SET status = $1, manager_comment = $2
         WHERE cycle_id = $3 AND employee_id = $4 AND status = 'submitted'`,
        [action, comment || null, cycleId, employeeId]
      );

      await db.query(
        `UPDATE employee_cycle_assignments SET goals_status = $1
         WHERE review_cycle_id = $2 AND employee_id = $3`,
        [action, cycleId, employeeId]
      );

      await db.query(
        `INSERT INTO goal_approval_log (cycle_id, employee_id, actor_id, action, comment)
         VALUES ($1,$2,$3,$4,$5)`,
        [cycleId, employeeId, actor_id, action, comment || null]
      );

      await db.query('COMMIT');
      res.json({ ok: true, action });
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }
  } catch (e) { next(e); }
});

// PUT /api/goals/cycle/:cycleId/employee/:employeeId/hr-lock
// HR validates and locks goals — unlocks check-in schedule
// Body: { actor_id, comment? }
router.put('/cycle/:cycleId/employee/:employeeId/hr-lock', async (req, res, next) => {
  try {
    const { cycleId, employeeId } = req.params;
    const { actor_id, comment } = req.body;

    if (!actor_id) return res.status(400).json({ error: 'actor_id (HR employee id) is required' });

    const { rows: goals } = await db.query(
      `SELECT * FROM employee_goals
       WHERE cycle_id = $1 AND employee_id = $2 AND status = 'manager_approved'`,
      [cycleId, employeeId]
    );
    if (!goals.length) {
      return res.status(400).json({ error: 'No manager-approved goals found to lock' });
    }

    await db.query('BEGIN');
    try {
      await db.query(
        `UPDATE employee_goals SET status = 'hr_locked', hr_comment = $1
         WHERE cycle_id = $2 AND employee_id = $3 AND status = 'manager_approved'`,
        [comment || null, cycleId, employeeId]
      );

      await db.query(
        `UPDATE employee_cycle_assignments SET goals_status = 'hr_locked'
         WHERE review_cycle_id = $1 AND employee_id = $2`,
        [cycleId, employeeId]
      );

      await db.query(
        `INSERT INTO goal_approval_log (cycle_id, employee_id, actor_id, action, comment)
         VALUES ($1,$2,$3,'hr_locked',$4)`,
        [cycleId, employeeId, actor_id, comment || null]
      );

      await db.query('COMMIT');
      res.json({ ok: true });
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }
  } catch (e) { next(e); }
});

// GET /api/goals/cycle/:cycleId
// HR/manager view — all employees in a cycle with their goals_status
router.get('/cycle/:cycleId', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT e.id AS employee_id, e.name, e.email, e.role,
              eca.goals_status,
              COUNT(g.id) FILTER (WHERE g.objective_type != 'Values') AS goal_count,
              ROUND(SUM(g.weightage) FILTER (WHERE g.objective_type != 'Values'), 2) AS total_weightage
       FROM employee_cycle_assignments eca
       JOIN employees e ON e.id = eca.employee_id
       LEFT JOIN employee_goals g
              ON g.employee_id = eca.employee_id AND g.cycle_id = eca.review_cycle_id
       WHERE eca.review_cycle_id = $1
       GROUP BY e.id, e.name, e.email, e.role, eca.goals_status
       ORDER BY e.name`,
      [req.params.cycleId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
