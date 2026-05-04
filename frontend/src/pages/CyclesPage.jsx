import { useEffect, useState } from 'react';
import {
  Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Paper, Stack, Alert, MenuItem, Select, InputLabel, FormControl, Chip,
  List, ListItem, ListItemText, ListItemSecondaryAction, Divider, CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import PeopleIcon from '@mui/icons-material/People';
import DeleteIcon from '@mui/icons-material/Delete';
import { api } from '../api/client';

const statusColor = {
  draft:     'default',
  active:    'primary',
  completed: 'success',
  cancelled: 'error',
};

const CHECKIN_TYPE_OPTIONS = [
  { value: 'per_sprint', label: 'Per Sprint (2 weeks)' },
  { value: 'monthly',    label: 'Monthly' },
  { value: 'quarterly',  label: 'Quarterly' },
  { value: 'mid_year',   label: 'Mid Year (H1 / H2)' },
  { value: 'yearly',     label: 'Yearly' },
];

const checkinTypeLabel = (v) => CHECKIN_TYPE_OPTIONS.find(o => o.value === v)?.label || v;

// Fiscal year: April 1 → March 31 of the following year.
// If we are already past April 1 this calendar year, the current FY started this year.
// Otherwise it started last year.
function fiscalYearDefaults() {
  const today = new Date();
  const fyStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return {
    start_date: `${fyStart}-04-01`,
    end_date:   `${fyStart + 1}-03-31`,
  };
}

const emptyForm = () => ({
  name: '',
  ...fiscalYearDefaults(),
  checkin_type: 'quarterly',
  employee_notify_interval_days: 7,
  manager_notify_interval_days: 7,
  delivery_head_notify_interval_days: 7,
  status: 'draft',
});

// ── Assign Employees dialog ───────────────────────────────────────────────────
function AssignDialog({ cycle, onClose }) {
  const [assignments, setAssignments]   = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [activeMap, setActiveMap]       = useState({});   // employee_id → cycle_name
  const [selectedEmp, setSelectedEmp]   = useState('');
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  const load = async () => {
    const [asgn, emps, active] = await Promise.all([
      api.listAssignments(cycle.id),
      api.listEmployees(),
      api.listActiveAssignments(),
    ]);
    setAssignments(asgn);
    setAllEmployees(emps);
    // Build map: employee_id → cycle_name for employees in OTHER active cycles
    const map = {};
    for (const a of active) {
      if (a.cycle_id !== cycle.id) map[a.employee_id] = a.cycle_name;
    }
    setActiveMap(map);
  };

  useEffect(() => { load(); }, [cycle.id]);

  const assignedIds   = new Set(assignments.map(a => a.employee_id));
  // Employees not yet in THIS cycle (include those in other cycles so we can show them grayed out)
  const notInThisCycle = allEmployees.filter(e => !assignedIds.has(e.id));

  const assign = async () => {
    if (!selectedEmp) return;
    setSaving(true);
    try {
      await api.createAssignment({ employee_id: selectedEmp, review_cycle_id: cycle.id });
      setSelectedEmp('');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    try {
      await api.deleteAssignment(id);
      await load();
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Assign to Cycle — {cycle.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

          <Alert severity="info" icon={false} sx={{ py: 0.5 }}>
            Any persona (employee, manager, DD, HR) can be assigned. Each person belongs to{' '}
            <strong>one active cycle at a time</strong>. A manager's appraiser is whoever
            is set as their <em>Manager</em> in the system (e.g. their DD). People already
            in another active cycle appear grayed out.
          </Alert>

          {/* Add employee */}
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControl fullWidth size="small">
              <InputLabel>Select employee</InputLabel>
              <Select
                label="Select employee"
                value={selectedEmp}
                onChange={e => setSelectedEmp(e.target.value)}
              >
                {notInThisCycle.map(e => {
                  const takenBy = activeMap[e.id];
                  return (
                    <MenuItem key={e.id} value={e.id} disabled={!!takenBy}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {e.name}
                      <Chip size="small" label={e.role} variant="outlined"
                        sx={{ fontSize: 10, height: 18, pointerEvents: 'none' }} />
                      {takenBy && (
                        <Typography variant="caption" sx={{ ml: 'auto', color: 'text.disabled' }}>
                          in {takenBy}
                        </Typography>
                      )}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            <Button
              variant="contained" onClick={assign}
              disabled={!selectedEmp || saving}
              startIcon={saving ? <CircularProgress size={16} /> : <AddIcon />}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Assign
            </Button>
          </Stack>

          <Divider />

          {/* Current assignments */}
          {assignments.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No employees assigned yet.
            </Typography>
          ) : (
            <List dense disablePadding>
              {assignments.map(a => (
                <ListItem key={a.id} disablePadding sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={a.employee_name}
                    secondary={
                      a.prompt_sent
                        ? 'Prompt sent'
                        : 'Pending prompt'
                    }
                    secondaryTypographyProps={{
                      color: a.prompt_sent ? 'success.main' : 'text.secondary',
                      variant: 'caption',
                    }}
                  />
                  <ListItemSecondaryAction>
                    <Chip
                      size="small"
                      label={a.prompt_sent ? 'Notified' : 'Not notified'}
                      color={a.prompt_sent ? 'success' : 'default'}
                      variant="outlined"
                      sx={{ mr: 1 }}
                    />
                    <IconButton edge="end" size="small" onClick={() => remove(a.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function CyclesPage() {
  const [rows, setRows]             = useState([]);
  const [open, setOpen]             = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(emptyForm);
  const [error, setError]           = useState('');
  const [assigningCycle, setAssigningCycle] = useState(null);

  const load = async () => {
    try { setRows(await api.listCycles()); }
    catch (e) { setError(e.message); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit   = (row) => {
    setEditing(row);
    setForm({
      name:        row.name,
      start_date:  row.start_date?.slice(0, 10) || '',
      end_date:    row.end_date?.slice(0, 10)   || '',
      checkin_type: row.checkin_type || 'quarterly',
      employee_notify_interval_days:      row.employee_notify_interval_days,
      manager_notify_interval_days:       row.manager_notify_interval_days,
      delivery_head_notify_interval_days: row.delivery_head_notify_interval_days,
      status: row.status,
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      if (editing) await api.updateCycle(editing.id, form);
      else         await api.createCycle(form);
      setOpen(false); load();
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const f = (k, v) => {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      // Fiscal year always ends March 31 of (start year + 1)
      if (k === 'start_date' && v) {
        const startYear = new Date(v).getFullYear();
        next.end_date = `${startYear + 1}-03-31`;
      }
      return next;
    });
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">Review Cycles</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          New Cycle
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Check-In Type</TableCell>
              <TableCell>Start</TableCell>
              <TableCell>End</TableCell>
              <TableCell>Notify (E / M / DH)</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={checkinTypeLabel(r.checkin_type || 'quarterly')}
                    variant="outlined"
                    color="secondary"
                  />
                </TableCell>
                <TableCell>{r.start_date?.slice(0, 10)}</TableCell>
                <TableCell>{r.end_date?.slice(0, 10)}</TableCell>
                <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {r.employee_notify_interval_days}d / {r.manager_notify_interval_days}d / {r.delivery_head_notify_interval_days}d
                </TableCell>
                <TableCell>
                  <Chip size="small" label={r.status} color={statusColor[r.status]} />
                </TableCell>
                <TableCell align="right">
                  <IconButton title="Assign employees" onClick={() => setAssigningCycle(r)}>
                    <PeopleIcon />
                  </IconButton>
                  <IconButton onClick={() => openEdit(r)}><EditIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {assigningCycle && (
        <AssignDialog cycle={assigningCycle} onClose={() => setAssigningCycle(null)} />
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Edit Cycle' : 'New Review Cycle'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Cycle name" fullWidth required
              value={form.name}
              onChange={e => f('name', e.target.value)}
            />

            {/* Check-in type — prominent, full width */}
            <FormControl fullWidth required>
              <InputLabel>Check-In Type</InputLabel>
              <Select
                label="Check-In Type"
                value={form.checkin_type}
                onChange={e => f('checkin_type', e.target.value)}
              >
                {CHECKIN_TYPE_OPTIONS.map(o => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction="row" spacing={2}>
              <TextField
                label="Start date" type="date" fullWidth required
                InputLabelProps={{ shrink: true }}
                value={form.start_date}
                onChange={e => f('start_date', e.target.value)}
              />
              <TextField
                label="End date" type="date" fullWidth required
                InputLabelProps={{ shrink: true }}
                value={form.end_date}
                onChange={e => f('end_date', e.target.value)}
              />
            </Stack>

            <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
              Fiscal year runs <strong>1 April → 31 March</strong> of the following year. End date is
              auto-filled when you set the start date. The <strong>Check-In Type</strong> defines the
              cadence within that year — e.g. Monthly = 12 periods, Per Sprint = 26. Periods are
              auto-generated when the cycle is set to Active.
            </Typography>

            <Stack direction="row" spacing={2}>
              <TextField
                label="Employee notify (days)" type="number" fullWidth
                value={form.employee_notify_interval_days}
                onChange={e => f('employee_notify_interval_days', Number(e.target.value))}
              />
              <TextField
                label="Manager notify (days)" type="number" fullWidth
                value={form.manager_notify_interval_days}
                onChange={e => f('manager_notify_interval_days', Number(e.target.value))}
              />
              <TextField
                label="Delivery head notify (days)" type="number" fullWidth
                value={form.delivery_head_notify_interval_days}
                onChange={e => f('delivery_head_notify_interval_days', Number(e.target.value))}
              />
            </Stack>

            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={form.status}
                onChange={e => f('status', e.target.value)}
              >
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
