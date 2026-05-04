const router = require('express').Router();
const db = require('../db');

// ── Check-in period generation ────────────────────────────────────────────────
const CHECKIN_TYPES = ['per_sprint', 'monthly', 'quarterly', 'mid_year', 'yearly'];

function buildPeriods(checkinType, startDate, endDate) {
  const periods = [];
  const start = new Date(startDate);
  const end   = new Date(endDate);
  let num = 1;

  const fmt = (d) => d.toISOString().slice(0, 10);
  const clamp = (d) => d > end ? new Date(end) : d;

  switch (checkinType) {
    case 'per_sprint': {
      let cur = new Date(start);
      while (cur <= end) {
        const pEnd = clamp(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 13));
        periods.push({ number: num++, label: `Sprint ${num - 1}`, start: fmt(cur), end: fmt(pEnd) });
        cur = new Date(pEnd); cur.setDate(cur.getDate() + 1);
      }
      break;
    }
    case 'monthly': {
      let y = start.getFullYear(), m = start.getMonth();
      const endY = end.getFullYear(), endM = end.getMonth();
      while (y < endY || (y === endY && m <= endM)) {
        const pStart = new Date(Math.max(new Date(y, m, 1), start));
        const pEnd   = clamp(new Date(y, m + 1, 0));          // last day of month
        const label  = pStart.toLocaleString('en-US', { month: 'long', year: 'numeric' }) + ' Check-In';
        periods.push({ number: num++, label, start: fmt(pStart), end: fmt(pEnd) });
        if (++m > 11) { m = 0; y++; }
      }
      break;
    }
    case 'quarterly': {
      const QUARTERS = [[0, 2], [3, 5], [6, 8], [9, 11]];
      for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
        QUARTERS.forEach(([sm, em], qi) => {
          const pStart = new Date(y, sm, 1);
          const pEnd   = new Date(y, em + 1, 0);
          if (pEnd < start || pStart > end) return;
          const s = pStart < start ? new Date(start) : pStart;
          const e = clamp(pEnd);
          periods.push({ number: num++, label: `Q${qi + 1} ${y} Check-In`, start: fmt(s), end: fmt(e) });
        });
      }
      break;
    }
    case 'mid_year': {
      const HALVES = [[0, 5], [6, 11]];
      for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
        HALVES.forEach(([sm, em], hi) => {
          const pStart = new Date(y, sm, 1);
          const pEnd   = new Date(y, em + 1, 0);
          if (pEnd < start || pStart > end) return;
          const s = pStart < start ? new Date(start) : pStart;
          const e = clamp(pEnd);
          periods.push({ number: num++, label: `H${hi + 1} ${y} Check-In`, start: fmt(s), end: fmt(e) });
        });
      }
      break;
    }
    case 'yearly': {
      for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
        const pStart = new Date(y, 0, 1);
        const pEnd   = new Date(y, 11, 31);
        if (pEnd < start || pStart > end) return;
        const s = pStart < start ? new Date(start) : pStart;
        const e = clamp(pEnd);
        periods.push({ number: num++, label: `${y} Annual Check-In`, start: fmt(s), end: fmt(e) });
      }
      break;
    }
    default: break;
  }
  return periods;
}

async function generatePeriodsForCycle(cycleId, checkinType, startDate, endDate) {
  const periods = buildPeriods(checkinType, startDate, endDate);
  await db.query('DELETE FROM checkin_periods WHERE review_cycle_id = $1', [cycleId]);
  for (const p of periods) {
    await db.query(
      `INSERT INTO checkin_periods (review_cycle_id, period_number, period_label, period_start, period_end, status)
       VALUES ($1, $2, $3, $4, $5, 'upcoming')`,
      [cycleId, p.number, p.label, p.start, p.end]
    );
  }
  return periods.length;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/cycles
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*, e.name AS created_by_name
       FROM review_cycles c
       LEFT JOIN employees e ON e.id = c.created_by
       ORDER BY c.start_date DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/cycles/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(`SELECT * FROM review_cycles WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// POST /api/cycles
router.post('/', async (req, res, next) => {
  try {
    const {
      name, start_date, end_date,
      checkin_type = 'quarterly',
      employee_notify_interval_days = 7,
      manager_notify_interval_days = 7,
      delivery_head_notify_interval_days = 7,
      status = 'draft',
      created_by,
    } = req.body;
    if (!name || !start_date || !end_date) {
      return res.status(400).json({ error: 'name, start_date, end_date required' });
    }
    if (!CHECKIN_TYPES.includes(checkin_type)) {
      return res.status(400).json({ error: `checkin_type must be one of: ${CHECKIN_TYPES.join(', ')}` });
    }
    const { rows } = await db.query(
      `INSERT INTO review_cycles
         (name, start_date, end_date, checkin_type,
          employee_notify_interval_days, manager_notify_interval_days,
          delivery_head_notify_interval_days, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, start_date, end_date, checkin_type,
       employee_notify_interval_days, manager_notify_interval_days,
       delivery_head_notify_interval_days, status, created_by]
    );
    const cycle = rows[0];
    if (cycle.status === 'active') {
      const count = await generatePeriodsForCycle(cycle.id, cycle.checkin_type, cycle.start_date, cycle.end_date);
      console.log(`[cycles] generated ${count} check-in periods for cycle ${cycle.id}`);
    }
    res.status(201).json(cycle);
  } catch (e) { next(e); }
});

// PUT /api/cycles/:id
router.put('/:id', async (req, res, next) => {
  try {
    const {
      name, start_date, end_date, checkin_type,
      employee_notify_interval_days,
      manager_notify_interval_days,
      delivery_head_notify_interval_days,
      status,
    } = req.body;

    if (checkin_type !== undefined && !CHECKIN_TYPES.includes(checkin_type)) {
      return res.status(400).json({ error: `checkin_type must be one of: ${CHECKIN_TYPES.join(', ')}` });
    }

    const { rows } = await db.query(
      `UPDATE review_cycles SET
         name       = COALESCE($1, name),
         start_date = COALESCE($2, start_date),
         end_date   = COALESCE($3, end_date),
         checkin_type                       = COALESCE($4, checkin_type),
         employee_notify_interval_days      = COALESCE($5, employee_notify_interval_days),
         manager_notify_interval_days       = COALESCE($6, manager_notify_interval_days),
         delivery_head_notify_interval_days = COALESCE($7, delivery_head_notify_interval_days),
         status     = COALESCE($8, status)
       WHERE id = $9
       RETURNING *`,
      [name, start_date, end_date, checkin_type,
       employee_notify_interval_days, manager_notify_interval_days,
       delivery_head_notify_interval_days, status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const cycle = rows[0];

    // Regenerate periods if cycle just became active or dates/type changed
    const needsRegen = status === 'active' || start_date || end_date || checkin_type;
    if (cycle.status === 'active' && needsRegen) {
      const count = await generatePeriodsForCycle(cycle.id, cycle.checkin_type, cycle.start_date, cycle.end_date);
      console.log(`[cycles] regenerated ${count} check-in periods for cycle ${cycle.id}`);
    }

    res.json(cycle);
  } catch (e) { next(e); }
});

module.exports = router;
