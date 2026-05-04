/**
 * AI service - calls local Ollama (gemma3:1b by default).
 * Two capabilities for this iteration:
 *   1. Summarization (for manager / DH / HR handoffs)
 *   4. Employee response quality coaching (was this answer too thin?)
 *
 * Same async contract as the old stub, so the flow service is unchanged.
 */

const BASE_URL   = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL      = process.env.OLLAMA_MODEL    || 'gemma3:1b';
const TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '30000', 10);

/**
 * Thin wrapper around Ollama's /api/generate.
 * Returns the response string, or throws on timeout/error.
 */
async function callOllama(prompt, { system, temperature = 0.3 } = {}) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    console.log(`[ai] calling Ollama (${MODEL}), prompt length=${prompt.length}`);
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        system,
        stream: false,
        options: { temperature },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const out = (data.response || '').trim();
    console.log(`[ai] Ollama responded in ${Date.now() - started}ms, length=${out.length}, preview="${out.slice(0, 80)}"`);
    return out;
  } finally {
    clearTimeout(to);
  }
}

// ---------------------------------------------------------------------
// 1. Summarization
// ---------------------------------------------------------------------

function formatResponses(responses) {
  return responses
    .map((r) => `Q${r.question_order}: ${r.question_text}\nA: ${r.response_text}`)
    .join('\n\n');
}

async function summarizeEmployeeResponses(employee, responses) {
  const prompt = `Summarize the following appraisal responses by ${employee.name} into a concise briefing for their manager.

Rules:
- 4-6 bullet points maximum
- Factual, neutral tone
- Highlight concrete achievements, learnings, and stated growth goals
- Do NOT add praise or judgement
- Do NOT invent details not present in the responses

Responses:
${formatResponses(responses)}

Briefing:`;

  try {
    const out = await callOllama(prompt, {
      system: 'You are an HR assistant that produces short, factual briefings.',
      temperature: 0.2,
    });
    if (!out) throw new Error('empty response from model');
    return out;
  } catch (err) {
    console.error('[ai] summarizeEmployeeResponses failed, using fallback', err.message);
    const bullets = responses
      .map((r) => `• Q${r.question_order}: ${r.response_text.slice(0, 200)}`)
      .join('\n');
    return `[AI summary unavailable — showing raw responses]\n${bullets}`;
  }
}

async function summarizeForDeliveryHead(employee, employeeResponses, managerFeedback) {
  const prompt = `Produce a briefing for a delivery head reviewing ${employee.name}'s appraisal.

Rules:
- 2 short sections: "Employee self-review" (3-4 bullets) and "Manager feedback" (2-3 bullets)
- Factual, neutral tone
- Do NOT invent details

Employee responses:
${formatResponses(employeeResponses)}

Manager (${managerFeedback.manager_name || 'unknown'}) feedback:
${managerFeedback.feedback_text || '(none provided)'}

Briefing:`;

  try {
    const out = await callOllama(prompt, {
      system: 'You are an HR assistant producing concise review briefings.',
      temperature: 0.2,
    });
    if (!out) throw new Error('empty response from model');
    return out;
  } catch (err) {
    console.error('[ai] summarizeForDeliveryHead failed, using fallback', err.message);
    return `[AI summary unavailable]
Employee responses: ${employeeResponses.length}
Manager feedback: ${managerFeedback?.feedback_text?.slice(0, 200) || '(none)'}`;
  }
}

async function summarizeForHR(employee, employeeResponses, managerFeedback, dhReview) {
  const prompt = `Produce a final briefing for HR closing the appraisal of ${employee.name}.

Rules:
- 3 short sections: "Self-review", "Manager view", "Delivery head view"
- 2-3 bullets each
- Factual, neutral tone
- Do NOT invent details

Employee responses:
${formatResponses(employeeResponses)}

Manager feedback:
${managerFeedback?.feedback_text || '(none)'}

Delivery head review:
${dhReview?.review_text || '(none)'}

Briefing:`;

  try {
    const out = await callOllama(prompt, {
      system: 'You are an HR assistant producing concise, balanced closing briefings.',
      temperature: 0.2,
    });
    if (!out) throw new Error('empty response from model');
    return out;
  } catch (err) {
    console.error('[ai] summarizeForHR failed, using fallback', err.message);
    return `[AI summary unavailable]
Employee responses: ${employeeResponses.length}
Manager: ${managerFeedback?.feedback_text?.slice(0, 200) || '(none)'}
Delivery head: ${dhReview?.review_text?.slice(0, 200) || '(none)'}`;
  }
}

// ---------------------------------------------------------------------
// 4. Response quality coaching
// ---------------------------------------------------------------------

/**
 * Decide whether an employee's answer is thin enough to suggest expanding it.
 * Returns { thin: boolean, hint?: string }.
 *
 * We use a fast heuristic first (word count / specificity signals), and only
 * call the model for borderline cases. This keeps the flow snappy.
 */
async function coachEmployeeAnswer(question, answer) {
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const charCount = answer.trim().length;

  // Obvious cases — no need to call the model
  if (charCount < 20 || words.length < 5) {
    return {
      thin: true,
      hint: 'Your answer looks quite short. Reviewers usually appreciate a concrete example or specifics. Want to add more? Reply with your revised answer, or send *skip* to keep it as is.',
    };
  }
  if (words.length >= 40) {
    return { thin: false };
  }

  // Borderline — ask the model
  const prompt = `You are checking whether an employee's appraisal answer is substantive enough.

Question: ${question}
Answer: ${answer}

Reply strictly with JSON only, no prose:
{"thin": true|false, "reason": "short explanation"}

"thin" should be true ONLY if the answer is vague, lacks any specifics, or is clearly too short for the question. Otherwise false.`;

  try {
    const raw = await callOllama(prompt, {
      system: 'You respond only with valid JSON. No markdown, no prose.',
      temperature: 0.1,
    });
    // Extract JSON even if the model added stray characters
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { thin: false };
    const parsed = JSON.parse(match[0]);
    if (parsed.thin === true) {
      return {
        thin: true,
        hint: `Your answer could be stronger — ${parsed.reason || 'consider adding specifics'}. Want to revise? Reply with an updated answer, or send *skip* to keep it as is.`,
      };
    }
    return { thin: false };
  } catch (err) {
    // If the model fails, don't block the flow — treat as acceptable
    console.error('[ai] coachEmployeeAnswer failed, treating as acceptable', err.message);
    return { thin: false };
  }
}

// ---------------------------------------------------------------------
// 5. Quarterly check-in summary for manager review
// ---------------------------------------------------------------------

/**
 * Summarise all check-in responses an employee submitted within one quarter.
 * Each item in `checkins` has: period_label, question_text, response_text.
 */
async function summarizeCheckinsForQuarterlyReview(employee, checkins, quarterLabel) {
  const grouped = {};
  for (const ci of checkins) {
    if (!grouped[ci.period_label]) grouped[ci.period_label] = [];
    grouped[ci.period_label].push(`  Q: ${ci.question_text}\n  A: ${ci.response_text}`);
  }
  const body = Object.entries(grouped)
    .map(([label, items]) => `[${label}]\n${items.join('\n')}`)
    .join('\n\n');

  const prompt = `You are an HR assistant generating a quarterly performance briefing for a manager.

Employee: ${employee.name}
Quarter: ${quarterLabel}

Check-in responses:
${body}

Write a concise quarterly summary for the manager covering:
- Key accomplishments across the quarter
- Recurring themes or growth areas
- Any concerns or blockers mentioned
- Suggested discussion points for the quarterly review meeting

Rules:
- Maximum 6 bullet points total
- Factual, neutral tone
- Do NOT invent details not present in the responses

Summary:`;

  try {
    const out = await callOllama(prompt, {
      system: 'You are an HR assistant that produces concise, factual quarterly briefings.',
      temperature: 0.2,
    });
    if (!out) throw new Error('empty response');
    return out;
  } catch (err) {
    console.error('[ai] summarizeCheckinsForQuarterlyReview failed', err.message);
    const lines = checkins.map(c => `• [${c.period_label}] ${c.response_text.slice(0, 150)}`);
    return `[AI summary unavailable — raw responses]\n${lines.join('\n')}`;
  }
}

module.exports = {
  summarizeEmployeeResponses,
  summarizeForDeliveryHead,
  summarizeForHR,
  coachEmployeeAnswer,
  summarizeCheckinsForQuarterlyReview,
};