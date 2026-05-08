import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Alert, MenuItem, Select, InputLabel, FormControl,
  Tabs, Tab, Chip, LinearProgress, Table, TableHead, TableRow,
  TableCell, TableBody, Paper, Stack, Box,
} from '@mui/material';
import CheckCircleIcon      from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon   from '@mui/icons-material/HourglassEmpty';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { api } from '../api/client';

// ── Status chip ───────────────────────────────────────────────────────────────
function StatusChip({ status }) {
  if (status === 'submitted') {
    return <Chip size="small" icon={<CheckCircleIcon />} label="Submitted" color="success" variant="filled" />;
  }
  if (status === 'pending') {
    return <Chip size="small" icon={<HourglassEmptyIcon />} label="Pending" color="warning" variant="outlined" />;
  }
  return <Chip size="small" icon={<RadioButtonUncheckedIcon />} label="Not started" color="default" variant="outlined" />;
}

function resolveEmployeeStatus(emp) {
  if (emp.employee_status !== 'submitted') return 'not_started';
  if (emp.manager_status  !== 'submitted') return 'pending';
  return 'submitted';
}

// ── Tab 1: Team digest (table) ────────────────────────────────────────────────
function TeamDigestTable({ rows, cycleId, onRowClick }) {
  if (!rows.length) return (
    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
      No employees found for this cycle.
    </Typography>
  );

  return (
    <Paper>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Manager</TableCell>
            <TableCell>Delivery Head</TableCell>
            <TableCell>Self-review</TableCell>
            <TableCell>Manager review</TableCell>
            <TableCell>Delivery head</TableCell>
            <TableCell>HR final</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.id} hover sx={{ cursor: 'pointer' }}
              onClick={() => onRowClick(r.id)}
            >
              <TableCell sx={{ fontWeight: 500 }}>{r.name}</TableCell>
              <TableCell>
                <Chip size="small" label={r.role} variant="outlined"
                  color={r.role === 'employee' ? 'default' : r.role === 'manager' ? 'primary' : r.role === 'delivery_head' ? 'secondary' : 'warning'} />
              </TableCell>
              <TableCell>{r.category_name || '—'}</TableCell>
              <TableCell>{r.manager_name || '—'}</TableCell>
              <TableCell>{r.delivery_head_name || '—'}</TableCell>
              <TableCell>
                <StatusChip status={r.employee_status === 'submitted' ? 'submitted' : 'not_started'} />
                {r.total_questions > 0 && (
                  <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                    {r.answered_count}/{r.total_questions}
                  </Typography>
                )}
              </TableCell>
              <TableCell><StatusChip status={r.manager_status} /></TableCell>
              <TableCell><StatusChip status={r.delivery_head_status} /></TableCell>
              <TableCell><StatusChip status={r.hr_status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

// ── Tab 2: Check-in periods ───────────────────────────────────────────────────
const PERIOD_COLOR = { upcoming: 'default', active: 'primary', closed: 'success' };

function CheckinPeriodsPanel({ cycleId }) {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cycleId) return;
    setLoading(true);
    api.listCheckinPeriods(cycleId)
      .then(setPeriods).catch(() => {}).finally(() => setLoading(false));
  }, [cycleId]);

  if (loading) return <LinearProgress sx={{ mt: 2 }} />;

  if (!periods.length) return (
    <Alert severity="info" sx={{ mt: 2 }}>
      No check-in periods yet. Set the cycle status to <strong>Active</strong> to auto-generate them based on the configured check-in type.
    </Alert>
  );

  return (
    <Paper sx={{ mt: 2 }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Period</TableCell>
            <TableCell>Start</TableCell>
            <TableCell>End</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Responses</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {periods.map((p) => {
            const responded = parseInt(p.responded_employees, 10) || 0;
            const total     = parseInt(p.total_employees, 10) || 0;
            const pct       = total > 0 ? Math.round((responded / total) * 100) : 0;
            return (
              <TableRow key={p.id}>
                <TableCell sx={{ color: 'text.secondary', width: 40 }}>{p.period_number}</TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{p.period_label}</TableCell>
                <TableCell>{p.period_start ? new Date(p.period_start).toLocaleDateString('en-CA') : '—'}</TableCell>
                <TableCell>{p.period_end   ? new Date(p.period_end).toLocaleDateString('en-CA')   : '—'}</TableCell>
                <TableCell>
                  <Chip size="small" label={p.status} color={PERIOD_COLOR[p.status] || 'default'} />
                </TableCell>
                <TableCell sx={{ minWidth: 160 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'grey.200', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: pct === 100 ? 'success.main' : 'primary.main', borderRadius: 3, transition: 'width .4s' }} />
                    </Box>
                    <Typography variant="caption" sx={{ minWidth: 50, color: 'text.secondary' }}>
                      {responded}/{total}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}

// ── Tab 3: Quarterly reviews ──────────────────────────────────────────────────
function QuarterlyReviewsPanel({ cycleId }) {
  const [reviews, setReviews]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail]     = useState(null);
  const [notes, setNotes]       = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!cycleId) return;
    setLoading(true);
    api.listQuarterlyReviews(cycleId)
      .then(setReviews).catch(() => {}).finally(() => setLoading(false));
  }, [cycleId]);

  const openDetail = async (id) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    const d = await api.getQuarterlyReview(id);
    setDetail(d);
    setNotes(d.quarterlyReview.manager_notes || '');
  };

  const submit = async (id) => {
    setSaving(true);
    try {
      await api.updateQuarterlyReview(id, { manager_notes: notes, status: 'submitted' });
      setReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'submitted', manager_notes: notes } : r));
      setExpanded(null);
    } catch (e) { /* non-fatal */ }
    setSaving(false);
  };

  if (loading) return <LinearProgress sx={{ mt: 2 }} />;

  if (!reviews.length) return (
    <Alert severity="info" sx={{ mt: 2 }}>
      No quarterly reviews yet. They are auto-generated at the end of each calendar quarter when employees have submitted check-ins.
    </Alert>
  );

  // Group by quarter label
  const byQuarter = reviews.reduce((acc, r) => {
    (acc[r.quarter_label] = acc[r.quarter_label] || []).push(r);
    return acc;
  }, {});

  return (
    <Stack spacing={3} sx={{ mt: 2 }}>
      {Object.entries(byQuarter).map(([quarter, qReviews]) => (
        <Box key={quarter}>
          <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
            {quarter}
          </Typography>
          <Paper>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Manager</TableCell>
                  <TableCell>Check-ins</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {qReviews.map((r) => (
                  <>
                    <TableRow
                      key={r.id} hover sx={{ cursor: 'pointer' }}
                      onClick={() => openDetail(r.id)}
                    >
                      <TableCell sx={{ fontWeight: 500 }}>{r.employee_name}</TableCell>
                      <TableCell>{r.manager_name || '—'}</TableCell>
                      <TableCell>{r.checkin_count}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={r.status === 'submitted' ? 'Reviewed' : 'Pending review'}
                          color={r.status === 'submitted' ? 'success' : 'warning'}
                          variant={r.status === 'submitted' ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell sx={{ color: 'text.disabled', textAlign: 'right' }}>
                        {expanded === r.id ? '▲' : '▼'}
                      </TableCell>
                    </TableRow>

                    {expanded === r.id && detail?.quarterlyReview?.id === r.id && (
                      <TableRow key={`${r.id}-detail`}>
                        <TableCell colSpan={5} sx={{ bgcolor: 'grey.50', p: 3 }}>
                          <Stack spacing={2}>
                            {detail.quarterlyReview.ai_summary && (
                              <Box>
                                <Typography variant="caption" color="primary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                  AI Summary
                                </Typography>
                                <Paper variant="outlined" sx={{ p: 2, mt: 0.5, bgcolor: '#fff' }}>
                                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                    {detail.quarterlyReview.ai_summary}
                                  </Typography>
                                </Paper>
                              </Box>
                            )}

                            {detail.checkins.length > 0 && (
                              <Box>
                                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                  Check-in responses ({detail.checkins.length})
                                </Typography>
                                <Stack spacing={1} sx={{ mt: 0.5 }}>
                                  {detail.checkins.map((ci, i) => (
                                    <Box key={i} sx={{ pl: 1.5, borderLeft: '3px solid', borderColor: 'primary.light' }}>
                                      <Typography variant="caption" color="primary" fontWeight={600}>{ci.period_label}</Typography>
                                      <Typography variant="body2" color="text.secondary">Q: {ci.question_text}</Typography>
                                      <Typography variant="body2">A: {ci.response_text}</Typography>
                                    </Box>
                                  ))}
                                </Stack>
                              </Box>
                            )}

                            {r.status !== 'submitted' ? (
                              <Box>
                                <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                  Manager Notes
                                </Typography>
                                <textarea
                                  value={notes}
                                  onChange={e => setNotes(e.target.value)}
                                  placeholder="Add your quarterly feedback…"
                                  rows={4}
                                  style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                                />
                                <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1.5 }}>
                                  <Chip label="Cancel" onClick={() => setExpanded(null)} sx={{ cursor: 'pointer' }} />
                                  <Chip
                                    label={saving ? 'Saving…' : 'Submit review'}
                                    color="primary" onClick={() => submit(r.id)}
                                    disabled={saving} sx={{ cursor: 'pointer' }}
                                  />
                                </Stack>
                              </Box>
                            ) : (
                              r.manager_notes && (
                                <Box>
                                  <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    Manager Notes
                                  </Typography>
                                  <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                                    {r.manager_notes}
                                  </Typography>
                                </Box>
                              )
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      ))}
    </Stack>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const CHECKIN_TYPE_LABEL = {
  per_sprint: 'Per Sprint', monthly: 'Monthly',
  quarterly: 'Quarterly',   mid_year: 'Mid Year', yearly: 'Yearly',
};

export default function ReviewsPage() {
  const navigate = useNavigate();
  const [cycles, setCycles]               = useState([]);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [cycleObj, setCycleObj]           = useState(null);
  const [rows, setRows]                   = useState([]);
  const [tab, setTab]                     = useState(0);
  const [error, setError]                 = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.listCycles();
        setCycles(data);
        const active = data.find(c => c.status === 'active') || data[0];
        if (active) { setSelectedCycle(active.id); setCycleObj(active); }
      } catch (e) { setError(e.message); }
    })();
  }, []);

  useEffect(() => {
    if (!selectedCycle) return;
    const obj = cycles.find(c => c.id === selectedCycle);
    if (obj) setCycleObj(obj);
    api.listReviewsByCycle(selectedCycle)
      .then(setRows)
      .catch(e => setError(e.response?.data?.error || e.message));
  }, [selectedCycle, cycles]);

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Reviews</Typography>

      <Stack direction="row" alignItems="center" spacing={2}>
        <FormControl sx={{ maxWidth: 360 }} size="small">
          <InputLabel>Review cycle</InputLabel>
          <Select
            label="Review cycle"
            value={selectedCycle}
            onChange={e => {
              setSelectedCycle(e.target.value);
              setCycleObj(cycles.find(c => c.id === e.target.value) || null);
              setTab(0);
            }}
          >
            {cycles.map(c => (
              <MenuItem key={c.id} value={c.id}>{c.name} ({c.status})</MenuItem>
            ))}
          </Select>
        </FormControl>
        {cycleObj?.checkin_type && (
          <Chip
            size="small"
            label={`${CHECKIN_TYPE_LABEL[cycleObj.checkin_type] || cycleObj.checkin_type} check-ins`}
            color="secondary" variant="outlined"
          />
        )}
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      {cycleObj && (
        <>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Team digest" />
            <Tab label="Check-in periods" />
            <Tab label="Quarterly reviews" />
          </Tabs>

          {tab === 0 && (
            <>
              <TeamDigestTable
                rows={rows}
                cycleId={selectedCycle}
                onRowClick={id => navigate(`/reviews/cycle/${selectedCycle}/employee/${id}`)}
              />
              <Typography variant="caption" color="text.secondary">
                Click any row to see the full stakeholder responses.
              </Typography>
            </>
          )}
          {tab === 1 && <CheckinPeriodsPanel cycleId={selectedCycle} />}
          {tab === 2 && <QuarterlyReviewsPanel cycleId={selectedCycle} />}
        </>
      )}
    </Stack>
  );
}
