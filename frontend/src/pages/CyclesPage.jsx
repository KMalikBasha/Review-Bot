import { useEffect, useState } from 'react';
import {
  Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Paper, Stack, Alert, MenuItem, Select, InputLabel, FormControl, Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
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

const emptyForm = {
  name: '',
  start_date: '',
  end_date: '',
  checkin_type: 'quarterly',
  employee_notify_interval_days: 7,
  manager_notify_interval_days: 7,
  delivery_head_notify_interval_days: 7,
  status: 'draft',
};

export default function CyclesPage() {
  const [rows, setRows]       = useState([]);
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState(emptyForm);
  const [error, setError]     = useState('');

  const load = async () => {
    try { setRows(await api.listCycles()); }
    catch (e) { setError(e.message); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
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

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

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
                  <IconButton onClick={() => openEdit(r)}><EditIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

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
              Check-in periods are auto-generated from these dates when the cycle is set to Active.
              Managers receive an auto-generated quarterly review at the end of each calendar quarter.
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
