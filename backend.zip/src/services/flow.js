const db = require('../db');
const ai = require('./ai');
const { sendSlackProactiveMessage } = require('../slack/proactive');
const { sendProactiveMessage }      = require('../bot/proactive');

async function sendTo(user, msg) {
  if (user.slack_user_id) return sendSlackProactiveMessage(user.slack_user_id, msg);
  if (user.teams_user_id) return sendProactiveMessage(user.teams_user_id, msg);
  return { ok: false, reason: 'no_messaging_id' };
}

/**
 * Flow service — channel-agnostic state machine that drives the
 * appraisal conversation.
 *
 * Public API:
 *   handleIncoming({ employee, channel }, text) => { messages: [string|object] }
 *
 * Internal: each role (employee/manager/delivery_head/hr) has a small
 * state machine with steps:
 *
 *   ─ employee ───────────────────────────────────────
 *   choose_mode      → user picks 'one' or 'all'
 *   ask_question     → bot asks Q{i}, user replies → stored → next
 *   confirm_submit   → all answers collected → confirm → save
 *
 *   ─ manager ────────────────────────────────────────
 *   pick_employee    → (if multiple pending) pick which employee
 *   show_summary     → show AI summary of employee responses
 *   collect_feedback → bot asks for feedback text
 *   confirm_submit
 *
 *   ─ delivery_head / hr ─────────────────────────────
 *   pick_employee
 *   show_summary
 *   collect_review_or_final
 *   confirm_submit
 */

// ---------- session helpers ----------

async function getSession(employeeId, channel) {
  const { rows } = await db.query(
    `SELECT * FROM flow_sessions WHERE employee_id = $1 AND channel = $2 ORDER BY id DESC LIMIT 1`,
    [employeeId, channel]
  );
  return rows[0] || null;
}

async function upsertSession(session) {
  if (session.id) {
    await db.query(
      `UPDATE flow_sessions SET step=$1, state=$2, updated_at=NOW() WHERE id=$3`,
      [session.step, session.state, session.id]
    );
    return session;
  }
  const { rows } = await db.query(
    `INSERT INTO flow_sessions (employee_id, role, review_cycle_id, target_employee_id, step, state, channel)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [session.employee_id, session.role, session.review_cycle_id, session.target_employee_id,
     session.step, session.state, session.channel]
  );
  return rows[0];
}

async function deleteSession(sessionId) {
  await db.query(`DELETE FROM flow_sessions WHERE id = $1`, [sessionId]);
}

// ---------- work discovery ----------

/**
 * Given the user's employee record, figure out what they need to do
 * in the currently active cycle. Returns:
 *   { cycleId, role, targetEmployees: [{id, name, ...}] }
 *   or null if nothing pending.
 */
async function findPendingWork(user) {
  // find active cycle(s) - assume one at a time for MVP
  const { rows: cycles } = await db.query(
    `SELECT * FROM review_cycles WHERE status='active' ORDER BY id DESC LIMIT 1`
  );
  if (!cycles.length) return null;
  const cycle = cycles[0];

  // ── Step 1: Own self-review (ANY role, if assigned to this cycle) ──────────
  // Self-review always takes priority over reviewing others.
  const { rows: assigned } = await db.query(
    `SELECT 1 FROM employee_cycle_assignments
     WHERE employee_id = $1 AND review_cycle_id = $2`,
    [user.id, cycle.id]
  );
  if (assigned.length) {
    const { rows: progress } = await db.query(
      `SELECT COUNT(*) FILTER (WHERE q.is_active) AS total,
              COUNT(r.id) AS answered
         FROM questionnaires q
         LEFT JOIN employee_responses r
           ON r.questionnaire_id = q.id
          AND r.employee_id = $1
          AND r.review_cycle_id = $2
        WHERE q.category_id = $3 AND q.is_active = TRUE`,
      [user.id, cycle.id, user.category_id]
    );
    const { total, answered } = progress[0];
    if (+answered < +total) {
      return { cycle, role: 'employee', targetEmployees: [user] };
    }
  }

  // ── Step 2: Appraiser review — anyone whose manager_id = this user ─────────
  // Works for any role: a DD whose id is set as manager_id for a manager-level
  // person will see that person here, acting as their appraiser.
  const { rows: directReports } = await db.query(
    `SELECT e.*, c.name AS category_name FROM employees e
       LEFT JOIN employee_categories c ON c.id = e.category_id
      WHERE e.manager_id = $1 AND e.is_active = TRUE
        AND EXISTS (
          SELECT 1 FROM employee_responses r
           WHERE r.employee_id = e.id AND r.review_cycle_id = $2
           GROUP BY r.employee_id
           HAVING COUNT(*) >= (
             SELECT COUNT(*) FROM questionnaires q
              WHERE q.category_id = e.category_id AND q.is_active = TRUE
           )
        )
        AND NOT EXISTS (
          SELECT 1 FROM manager_feedback mf
           WHERE mf.employee_id = e.id AND mf.review_cycle_id = $2
        )`,
    [user.id, cycle.id]
  );
  if (directReports.length) {
    return { cycle, role: 'manager', targetEmployees: directReports };
  }

  // ── Step 3: Delivery-head review — people with delivery_head_id = this user ─
  // Only runs after their manager feedback is in. Any role can be reviewed here.
  if (user.role === 'delivery_head') {
    const { rows } = await db.query(
      `SELECT e.*, c.name AS category_name FROM employees e
         LEFT JOIN employee_categories c ON c.id = e.category_id
        WHERE e.delivery_head_id = $1 AND e.is_active = TRUE
          AND EXISTS (
            SELECT 1 FROM manager_feedback mf
             WHERE mf.employee_id = e.id AND mf.review_cycle_id = $2
          )
          AND NOT EXISTS (
            SELECT 1 FROM delivery_head_reviews dh
             WHERE dh.employee_id = e.id AND dh.review_cycle_id = $2
          )`,
      [user.id, cycle.id]
    );
    if (rows.length) return { cycle, role: 'delivery_head', targetEmployees: rows };
  }

  // ── Step 4: HR final summary — anyone with DH review done ─────────────────
  if (user.role === 'hr') {
    const { rows } = await db.query(
      `SELECT e.*, c.name AS category_name FROM employees e
         LEFT JOIN employee_categories c ON c.id = e.category_id
        WHERE e.is_active = TRUE
          AND EXISTS (
            SELECT 1 FROM delivery_head_reviews dh
             WHERE dh.employee_id = e.id AND dh.review_cycle_id = $1
          )
          AND NOT EXISTS (
            SELECT 1 FROM final_summaries fs
             WHERE fs.employee_id = e.id AND fs.review_cycle_id = $1
          )`,
      [cycle.id]
    );
    if (rows.length) return { cycle, role: 'hr', targetEmployees: rows };
  }

  return null;
}

// ---------- main dispatcher ----------

async function handleIncoming({ user, channel }, rawText) {
  const text = (rawText || '').trim();
  const lower = text.toLowerCase();

  // universal commands
  if (['cancel', 'stop', 'quit'].includes(lower)) {
    const s = await getSession(user.id, channel);
    if (s) await deleteSession(s.id);
    return { messages: ['Cancelled. Type *start* when you\'re ready to resume.'] };
  }

  // Continue an existing session if any
  const existing = await getSession(user.id, channel);
  if (existing) return continueFlow(existing, user, channel, text);

  // No session — start command or info
  if (lower === 'start') return startFlow(user, channel);

  // Fallthrough = let caller handle (help/status/etc.)
  return null;
}

// ---------- start a new flow ----------

async function startFlow(user, channel) {
  const work = await findPendingWork(user);
  if (!work) {
    return { messages: ['You have no pending appraisal tasks right now. 🎉'] };
  }

  if (work.role === 'employee') {
    // Self-review flow — applies to ANY assigned persona, not just role='employee'
    await upsertSession({
      employee_id: user.id,
      role: 'employee',
      review_cycle_id: work.cycle.id,
      target_employee_id: user.id,
      step: 'choose_mode',
      state: {},
      channel,
    });
    return {
      messages: [
        `Let's complete your self-review for *${work.cycle.name}*.`,
        'Would you like me to ask you *one question at a time*, or show *all questions at once*?\nReply with *one* or *all*.',
      ],
    };
  }

  // reviewing others (manager / delivery_head / hr)
  if (work.targetEmployees.length === 1) {
    return beginPerEmployeeFlow(user, channel, work.cycle, work.role, work.targetEmployees[0]);
  }

  // Multi - ask to pick one (numbered list)
  const session = await upsertSession({
    employee_id: user.id,
    role: work.role,
    review_cycle_id: work.cycle.id,
    target_employee_id: null,
    step: 'pick_employee',
    state: { candidates: work.targetEmployees.map((e) => ({ id: e.id, name: e.name })) },
    channel,
  });

  const list = work.targetEmployees.map((e, i) => `${i + 1}. ${e.name}`).join('\n');
  return {
    messages: [
      `You have ${work.targetEmployees.length} pending reviews for *${work.cycle.name}*:`,
      list,
      'Reply with the *number* of the employee you\'d like to review first.',
    ],
  };
}

async function beginPerEmployeeFlow(user, channel, cycle, role, targetEmp) {
  if (role === 'manager') {
    const responses = await loadEmployeeResponses(targetEmp.id, cycle.id);
    const summary = await ai.summarizeEmployeeResponses(targetEmp, responses);

    const session = await upsertSession({
      employee_id: user.id,
      role: 'manager',
      review_cycle_id: cycle.id,
      target_employee_id: targetEmp.id,
      step: 'collect_feedback',
      state: { ai_summary: summary },
      channel,
    });
    return {
      messages: [
        `Reviewing *${targetEmp.name}* (${targetEmp.category_name}) for *${cycle.name}*.`,
        '*AI summary of their responses:*',
        summary,
        'Please reply with your *feedback* for this employee.',
      ],
    };
  }

  if (role === 'delivery_head') {
    const responses = await loadEmployeeResponses(targetEmp.id, cycle.id);
    const mgrFb = await loadManagerFeedback(targetEmp.id, cycle.id);
    const summary = await ai.summarizeForDeliveryHead(targetEmp, responses, mgrFb || {});

    const session = await upsertSession({
      employee_id: user.id,
      role: 'delivery_head',
      review_cycle_id: cycle.id,
      target_employee_id: targetEmp.id,
      step: 'collect_review',
      state: { ai_summary: summary },
      channel,
    });
    return {
      messages: [
        `Reviewing *${targetEmp.name}* for *${cycle.name}*.`,
        '*AI summary:*',
        summary,
        'Please reply with your *review* comments.',
      ],
    };
  }

  if (role === 'hr') {
    const responses = await loadEmployeeResponses(targetEmp.id, cycle.id);
    const mgrFb     = await loadManagerFeedback(targetEmp.id, cycle.id);
    const dhRev     = await loadDhReview(targetEmp.id, cycle.id);
    const summary   = await ai.summarizeForHR(targetEmp, responses, mgrFb, dhRev);

    const session = await upsertSession({
      employee_id: user.id,
      role: 'hr',
      review_cycle_id: cycle.id,
      target_employee_id: targetEmp.id,
      step: 'collect_final',
      state: { ai_summary: summary },
      channel,
    });
    return {
      messages: [
        `Final summary for *${targetEmp.name}* — *${cycle.name}*.`,
        '*AI summary:*',
        summary,
        'Please reply with your *final summary* to close the review.',
      ],
    };
  }
}

// ---------- continue an in-progress flow ----------

async function continueFlow(session, user, channel, text) {
  // pick_employee step (shared by manager/dh/hr)
  if (session.step === 'pick_employee') {
    const idx = parseInt(text, 10) - 1;
    const candidates = session.state.candidates || [];
    if (isNaN(idx) || idx < 0 || idx >= candidates.length) {
      return { messages: [`Please reply with a number between 1 and ${candidates.length}.`] };
    }
    const chosen = candidates[idx];
    const cycle = { id: session.review_cycle_id, name: (await loadCycle(session.review_cycle_id)).name };
    // overwrite the session into per-employee mode
    await deleteSession(session.id);
    return beginPerEmployeeFlow(user, channel, cycle, session.role, await loadEmployee(chosen.id));
  }

  // ---------- EMPLOYEE ----------
  if (session.role === 'employee') {
    if (session.step === 'choose_mode') {
      const mode = text.toLowerCase().startsWith('a') ? 'all' : 'one';
      const questions = await loadQuestionnaire(user.category_id);
      session.state = { mode, answers: {}, current_q_idx: 0, questions };
      session.step = 'ask_question';
      await upsertSession(session);

      if (mode === 'all') {
        const list = questions.map((q) => `*Q${q.question_order}.* ${q.question_text}`).join('\n\n');
        return {
          messages: [
            'Here are all questions. Please reply with your answers separated by `---` (three dashes) in question order.',
            list,
          ],
        };
      } else {
        return {
          messages: [`*Q${questions[0].question_order}.* ${questions[0].question_text}`],
        };
      }
    }

    if (session.step === 'ask_question') {
      const { mode, questions } = session.state;

      if (mode === 'all') {
        const parts = text.split(/\n?---\n?/).map((s) => s.trim()).filter(Boolean);
        if (parts.length !== questions.length) {
          return {
            messages: [
              `I got ${parts.length} answers, but expected ${questions.length}. Please resend all answers separated by \`---\`.`,
            ],
          };
        }
        questions.forEach((q, i) => { session.state.answers[q.id] = parts[i]; });
      } else {
        // ONE-AT-A-TIME mode with coaching
        const q = questions[session.state.current_q_idx];

        // Coaching: check if this answer is substantive. If thin, offer a revision.
        // We only coach the FIRST time the user answers each question; if they
        // already saw the hint and submitted again (or sent "skip"), accept it.
        const alreadyCoached = session.state.coached_for_q === q.id;
        if (!alreadyCoached) {
          const coach = await ai.coachEmployeeAnswer(q.question_text, text);
          if (coach.thin) {
            session.state.pending_answer = text;
            session.state.coached_for_q = q.id;
            await upsertSession(session);
            return { messages: [coach.hint] };
          }
        } else if (text.toLowerCase() === 'skip') {
          // user wants to keep the previously-coached answer as-is
          text = session.state.pending_answer;
        }
        delete session.state.pending_answer;
        delete session.state.coached_for_q;

        session.state.answers[q.id] = text;
        session.state.current_q_idx += 1;

        if (session.state.current_q_idx < questions.length) {
          const nextQ = questions[session.state.current_q_idx];
          await upsertSession(session);
          return { messages: [`Got it. *Q${nextQ.question_order}.* ${nextQ.question_text}`] };
        }
      }

      // All answers collected → save
      for (const q of questions) {
        await db.query(
          `INSERT INTO employee_responses (review_cycle_id, employee_id, questionnaire_id, response_text)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (review_cycle_id, employee_id, questionnaire_id)
           DO UPDATE SET response_text = EXCLUDED.response_text, submitted_at = NOW()`,
          [session.review_cycle_id, user.id, q.id, session.state.answers[q.id]]
        );
      }
      await deleteSession(session.id);

      // Immediately generate a quarterly summary and notify the manager now that
      // the self-review is complete — do NOT wait for the nightly scheduler.
      notifyManagerAfterSelfReview(user.id, session.review_cycle_id).catch(err =>
        console.error('[flow] manager notification failed', err.message)
      );

      return { messages: ['✅ Thanks! All your responses are recorded. Your manager will receive a summary shortly.'] };
    }
  }

  // ---------- MANAGER ----------
  if (session.role === 'manager' && session.step === 'collect_feedback') {
    await db.query(
      `INSERT INTO manager_feedback (review_cycle_id, employee_id, manager_id, ai_summary, feedback_text)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (review_cycle_id, employee_id)
       DO UPDATE SET feedback_text=EXCLUDED.feedback_text, ai_summary=EXCLUDED.ai_summary, submitted_at=NOW()`,
      [session.review_cycle_id, session.target_employee_id, user.id, session.state.ai_summary, text]
    );
    await deleteSession(session.id);

    // Check if more employees are still pending review
    const next = await findPendingWork(user);
    if (next && next.role === 'manager' && next.targetEmployees.length > 0) {
      const saved = next.targetEmployees.length === 1
        ? `✅ Feedback saved!\n\n*1 more employee to review:*`
        : `✅ Feedback saved!\n\n*${next.targetEmployees.length} more employees to review:*`;
      const list = next.targetEmployees.map((e, i) => `${i + 1}. ${e.name}`).join('\n');
      await upsertSession({
        employee_id: user.id,
        role: 'manager',
        review_cycle_id: next.cycle.id,
        target_employee_id: null,
        step: 'pick_employee',
        state: { candidates: next.targetEmployees.map((e) => ({ id: e.id, name: e.name })) },
        channel,
      });
      return { messages: [saved, list, 'Reply with the *number* of the employee you\'d like to review next.'] };
    }

    return { messages: ['✅ All done! Feedback saved for all employees. The delivery head will be notified.'] };
  }

  // ---------- DELIVERY HEAD ----------
  if (session.role === 'delivery_head' && session.step === 'collect_review') {
    await db.query(
      `INSERT INTO delivery_head_reviews (review_cycle_id, employee_id, delivery_head_id, ai_summary, review_text)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (review_cycle_id, employee_id)
       DO UPDATE SET review_text=EXCLUDED.review_text, ai_summary=EXCLUDED.ai_summary, submitted_at=NOW()`,
      [session.review_cycle_id, session.target_employee_id, user.id, session.state.ai_summary, text]
    );
    await deleteSession(session.id);

    const next = await findPendingWork(user);
    if (next && next.role === 'delivery_head' && next.targetEmployees.length > 0) {
      const saved = `✅ Review saved!\n\n*${next.targetEmployees.length} more to review:*`;
      const list = next.targetEmployees.map((e, i) => `${i + 1}. ${e.name}`).join('\n');
      await upsertSession({
        employee_id: user.id,
        role: 'delivery_head',
        review_cycle_id: next.cycle.id,
        target_employee_id: null,
        step: 'pick_employee',
        state: { candidates: next.targetEmployees.map((e) => ({ id: e.id, name: e.name })) },
        channel,
      });
      return { messages: [saved, list, 'Reply with the *number* of the employee you\'d like to review next.'] };
    }

    return { messages: ['✅ All done! Reviews saved. HR will be notified for the final summaries.'] };
  }

  // ---------- HR ----------
  if (session.role === 'hr' && session.step === 'collect_final') {
    await db.query(
      `INSERT INTO final_summaries (review_cycle_id, employee_id, hr_id, ai_summary, final_summary)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (review_cycle_id, employee_id)
       DO UPDATE SET final_summary=EXCLUDED.final_summary, ai_summary=EXCLUDED.ai_summary, submitted_at=NOW()`,
      [session.review_cycle_id, session.target_employee_id, user.id, session.state.ai_summary, text]
    );
    await deleteSession(session.id);

    const next = await findPendingWork(user);
    if (next && next.role === 'hr' && next.targetEmployees.length > 0) {
      const saved = `✅ Final summary recorded!\n\n*${next.targetEmployees.length} more to close:*`;
      const list = next.targetEmployees.map((e, i) => `${i + 1}. ${e.name}`).join('\n');
      await upsertSession({
        employee_id: user.id,
        role: 'hr',
        review_cycle_id: next.cycle.id,
        target_employee_id: null,
        step: 'pick_employee',
        state: { candidates: next.targetEmployees.map((e) => ({ id: e.id, name: e.name })) },
        channel,
      });
      return { messages: [saved, list, 'Reply with the *number* of the employee you\'d like to close next.'] };
    }

    return { messages: ['✅ All done! All appraisals are now complete.'] };
  }

  return { messages: ['Something went wrong with your session. Type *cancel* to reset.'] };
}

// ---------- data loaders ----------

async function loadQuestionnaire(categoryId) {
  const { rows } = await db.query(
    `SELECT id, question_order, question_text FROM questionnaires
      WHERE category_id = $1 AND is_active = TRUE ORDER BY question_order`,
    [categoryId]
  );
  return rows;
}

async function loadEmployeeResponses(employeeId, cycleId) {
  const { rows } = await db.query(
    `SELECT r.*, q.question_order, q.question_text
       FROM employee_responses r
       JOIN questionnaires q ON q.id = r.questionnaire_id
      WHERE r.employee_id = $1 AND r.review_cycle_id = $2
      ORDER BY q.question_order`,
    [employeeId, cycleId]
  );
  return rows;
}

async function loadManagerFeedback(employeeId, cycleId) {
  const { rows } = await db.query(
    `SELECT mf.*, e.name AS manager_name FROM manager_feedback mf
       LEFT JOIN employees e ON e.id = mf.manager_id
      WHERE mf.employee_id=$1 AND mf.review_cycle_id=$2`,
    [employeeId, cycleId]
  );
  return rows[0] || null;
}

async function loadDhReview(employeeId, cycleId) {
  const { rows } = await db.query(
    `SELECT * FROM delivery_head_reviews WHERE employee_id=$1 AND review_cycle_id=$2`,
    [employeeId, cycleId]
  );
  return rows[0] || null;
}

async function loadCycle(id) {
  const { rows } = await db.query(`SELECT * FROM review_cycles WHERE id=$1`, [id]);
  return rows[0];
}

async function loadEmployee(id) {
  const { rows } = await db.query(
    `SELECT e.*, c.name AS category_name FROM employees e
       LEFT JOIN employee_categories c ON c.id = e.category_id
      WHERE e.id=$1`,
    [id]
  );
  return rows[0];
}

// ---------- post-self-review manager notification ----------

/**
 * Called immediately after an employee finishes their self-review.
 * Generates an AI summary of their responses and sends it to their manager.
 * This replaces the scheduler-based notification for assigned employees.
 */
async function notifyManagerAfterSelfReview(employeeId, cycleId) {
  const emp = await loadEmployee(employeeId);
  if (!emp || !emp.manager_id) return;

  const cycle = await loadCycle(cycleId);
  const responses = await loadEmployeeResponses(employeeId, cycleId);
  if (!responses.length) return;

  const summary = await ai.summarizeEmployeeResponses(emp, responses);

  // Load manager messaging IDs
  const { rows: mgrRows } = await db.query(
    `SELECT id, name, slack_user_id, teams_user_id FROM employees WHERE id = $1`,
    [emp.manager_id]
  );
  const mgr = mgrRows[0];
  if (!mgr || (!mgr.slack_user_id && !mgr.teams_user_id)) return;

  const msg = {
    text: `${emp.name} has completed their self-review for ${cycle.name}.`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '📊 Self-Review Completed', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${emp.name}* has completed their self-review for *${cycle.name}*.\n\n*AI Summary of their responses:*`,
        },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: summary },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Submit Feedback', emoji: true },
            style: 'primary',
            action_id: 'start_appraisal',
          },
        ],
      },
    ],
  };

  await sendTo(mgr, msg);
  console.log(`[flow] manager ${mgr.name} notified after ${emp.name} completed self-review`);
}

module.exports = { handleIncoming, findPendingWork };