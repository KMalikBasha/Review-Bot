import { useEffect, useState } from 'react';
import {
  Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Paper, Stack, Alert, Chip, Tabs, Tab, Box,
  Select, MenuItem, FormControl, InputLabel, Tooltip,
} from '@mui/material';
import EditIcon   from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon    from '@mui/icons-material/Add';
import { api }   from '../api/client';

const OBJECTIVE_TYPES  = ['Financial', 'Customer Focus', 'Business Processes', 'People Related', 'Values'];
const GOAL_TYPES       = ['Numerical', 'Met or Not Met', 'Feedback'];
const GOAL_PERFORMANCE = ['The higher the better', 'The lower the better'];

const OBJ_COLORS = {
  'Financial':          'warning',
  'Customer Focus':     'primary',
  'Business Processes': 'info',
  'People Related':     'secondary',
  'Values':             'success',
};

const GOAL_TYPE_COLORS = {
  'Numerical':      'primary',
  'Met or Not Met': 'success',
  'Feedback':       'warning',
};

const EMPTY_FORM = {
  objective_type: 'Financial', area: '', commitment: '',
  weightage: '', kra_title: '', goal_description: '',
  goal_type: 'Numerical', goal_performance: 'The higher the better',
};

export default function GoalTemplatesPage() {
  const [roles, setRoles]       = useState([]);
  const [tabIdx, setTabIdx]     = useState(0);
  const [rows, setRows]         = useState([]);
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [error, setError]       = useState('');

  const currentRole = roles[tabIdx] || null;

  const loadRoles = async () => {
    try {
      const r = await api.listGoalTemplateRoles();
      setRoles(r);
    } catch (e) { setError(e.message); }
  };

  const loadRows = async (role) => {
    if (!role) return;
    try {
      const r = await api.listGoalTemplates({ role_name: role });
      setRows(r);
    } catch (e) { setError(e.message); }
  };

  useEffect(() => { loadRoles(); }, []);
  useEffect(() => { loadRows(currentRole); }, [currentRole]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      objective_type:   row.objective_type,
      area:             row.area,
      commitment:       row.commitment,
      weightage:        row.weightage ?? '',
      kra_title:        row.kra_title,
      goal_description: row.goal_description || '',
      goal_type:        row.goal_type,
      goal_performance: row.goal_performance,
    });
    setOpen(true);
  };

  const save = async () => {
    setError('');
    try {
      const payload = {
        ...form,
        role_name: currentRole,
        weightage: form.objective_type === 'Values' ? null
                 : form.weightage === '' ? null : Number(form.weightage),
      };
      if (editing) await api.updateGoalTemplate(editing.id, payload);
      else         await api.createGoalTemplate(payload);
      setOpen(false);
      loadRows(currentRole);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  };

  const remove = async (row) => {
    if (!confirm(`Deactivate KRA "${row.kra_title}"?\nIt will no longer appear in new goal selections.`)) return;
    try {
      await api.deleteGoalTemplate(row.id);
      loadRows(currentRole);
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  // Group rows by objective_type for display
  const grouped = OBJECTIVE_TYPES.reduce((acc, t) => {
    acc[t] = rows.filter(r => r.objective_type === t);
    return acc;
  }, {});

  const f = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">Goal Templates</Typography>
        <Button
          variant="contained" startIcon={<AddIcon />}
          onClick={openCreate} disabled={!currentRole}
        >
          Add KRA
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      {roles.length === 0 ? (
        <Alert severity="info">No templates found. Run the seed script (09_seed_goal_templates.sql) first.</Alert>
      ) : (
        <>
          <Tabs
            value={tabIdx}
            onChange={(_, v) => setTabIdx(v)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {roles.map((r) => <Tab key={r} label={r} />)}
          </Tabs>

          {OBJECTIVE_TYPES.map((objType) => {
            const section = grouped[objType];
            if (!section.length) return null;
            return (
              <Box key={objType}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <Chip label={objType} color={OBJ_COLORS[objType]} size="small" />
                  <Typography variant="caption" color="text.secondary">
                    {objType === 'Values'
                      ? `${section.length} values — no weightage`
                      : `${section.length} KRAs`}
                  </Typography>
                </Stack>
                <Paper variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell sx={{ width: 160 }}>Commitment</TableCell>
                        <TableCell>KRA / Goal</TableCell>
                        <TableCell sx={{ width: 90 }}>Type</TableCell>
                        <TableCell sx={{ width: 70 }} align="right">Weight</TableCell>
                        <TableCell sx={{ width: 80 }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {section.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>{row.commitment}</Typography>
                            <Typography variant="caption" color="text.secondary">{row.area}</Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip title={row.goal_description || ''} placement="top-start">
                              <Typography variant="body2">{row.kra_title}</Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={row.goal_type}
                              color={GOAL_TYPE_COLORS[row.goal_type] || 'default'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            {row.weightage != null
                              ? <Typography variant="body2" fontWeight={600}>{row.weightage}%</Typography>
                              : <Typography variant="body2" color="text.disabled">—</Typography>}
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" onClick={() => openEdit(row)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={() => remove(row)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Box>
            );
          })}
        </>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? 'Edit KRA' : `New KRA — ${currentRole}`}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <Stack direction="row" spacing={2}>
              <FormControl fullWidth required>
                <InputLabel>Objective Type</InputLabel>
                <Select
                  label="Objective Type"
                  value={form.objective_type}
                  onChange={f('objective_type')}
                >
                  {OBJECTIVE_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth required>
                <InputLabel>Goal Type</InputLabel>
                <Select
                  label="Goal Type"
                  value={form.goal_type}
                  onChange={f('goal_type')}
                >
                  {GOAL_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction="row" spacing={2}>
              <TextField
                label="Area" fullWidth required
                value={form.area} onChange={f('area')}
              />
              <TextField
                label="Commitment" fullWidth required
                value={form.commitment} onChange={f('commitment')}
              />
            </Stack>

            <TextField
              label="KRA / Goal Title" fullWidth required
              value={form.kra_title} onChange={f('kra_title')}
            />
            <TextField
              label="Goal Description" fullWidth multiline rows={3}
              value={form.goal_description} onChange={f('goal_description')}
            />

            <Stack direction="row" spacing={2}>
              <TextField
                label="Weightage (%)"
                type="number"
                value={form.objective_type === 'Values' ? '' : form.weightage}
                onChange={f('weightage')}
                disabled={form.objective_type === 'Values'}
                helperText={form.objective_type === 'Values' ? 'Values have no weightage' : ''}
                sx={{ width: 180 }}
                inputProps={{ min: 0, max: 100, step: 0.01 }}
              />
              <FormControl sx={{ minWidth: 220 }}>
                <InputLabel>Goal Performance</InputLabel>
                <Select
                  label="Goal Performance"
                  value={form.goal_performance}
                  onChange={f('goal_performance')}
                >
                  {GOAL_PERFORMANCE.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpen(false); setError(''); }}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
