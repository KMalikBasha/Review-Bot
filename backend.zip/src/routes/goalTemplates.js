const router = require('express').Router();
const db = require('../db');

// GET /api/goal-templates/roles
// Returns distinct role names (for dropdowns)
router.get('/roles', async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT role_name FROM goal_templates WHERE is_active = TRUE ORDER BY role_name`
    );
    res.json(rows.map(r => r.role_name));
  } catch (e) { next(e); }
});

// GET /api/goal-templates?role_name=X&objective_type=Y
// Returns template rows, optionally filtered
router.get('/', async (req, res, next) => {
  try {
    const { role_name, objective_type, include_inactive } = req.query;
    const conditions = [];
    const params = [];

    if (!include_inactive) {
      conditions.push('is_active = TRUE');
    }
    if (role_name) {
      params.push(role_name);
      conditions.push(`role_name = $${params.length}`);
    }
    if (objective_type) {
      params.push(objective_type);
      conditions.push(`objective_type = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT * FROM goal_templates ${where}
       ORDER BY role_name, objective_type, commitment, id`,
      params
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/goal-templates/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM goal_templates WHERE id = $1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// POST /api/goal-templates
// HR creates a new template row
router.post('/', async (req, res, next) => {
  try {
    const {
      role_name, objective_type, area, commitment,
      weightage, kra_title, goal_description,
      goal_type, goal_performance
    } = req.body;

    if (!role_name || !objective_type || !area || !commitment || !kra_title || !goal_type) {
      return res.status(400).json({ error: 'role_name, objective_type, area, commitment, kra_title, goal_type are required' });
    }

    // Values rows must not have weightage
    const isValues = objective_type === 'Values';
    if (isValues && weightage != null) {
      return res.status(400).json({ error: 'Values rows must not have a weightage' });
    }
    if (!isValues && (weightage == null || weightage <= 0)) {
      return res.status(400).json({ error: 'Non-Values rows require a positive weightage' });
    }

    const { rows } = await db.query(
      `INSERT INTO goal_templates
         (role_name, objective_type, area, commitment, weightage,
          kra_title, goal_description, goal_type, goal_performance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        role_name, objective_type, area, commitment,
        isValues ? null : weightage,
        kra_title, goal_description || null,
        goal_type, goal_performance || 'The higher the better'
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// PUT /api/goal-templates/:id
// HR updates a template row
router.put('/:id', async (req, res, next) => {
  try {
    const {
      role_name, objective_type, area, commitment,
      weightage, kra_title, goal_description,
      goal_type, goal_performance, is_active
    } = req.body;

    const isValues = objective_type === 'Values';

    const { rows } = await db.query(
      `UPDATE goal_templates SET
         role_name        = COALESCE($1, role_name),
         objective_type   = COALESCE($2, objective_type),
         area             = COALESCE($3, area),
         commitment       = COALESCE($4, commitment),
         weightage        = $5,
         kra_title        = COALESCE($6, kra_title),
         goal_description = COALESCE($7, goal_description),
         goal_type        = COALESCE($8, goal_type),
         goal_performance = COALESCE($9, goal_performance),
         is_active        = COALESCE($10, is_active)
       WHERE id = $11
       RETURNING *`,
      [
        role_name, objective_type, area, commitment,
        isValues ? null : weightage,
        kra_title, goal_description, goal_type,
        goal_performance, is_active, req.params.id
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE /api/goal-templates/:id
// Soft-delete (sets is_active = false) so existing employee_goals are not orphaned
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'UPDATE goal_templates SET is_active = FALSE WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
