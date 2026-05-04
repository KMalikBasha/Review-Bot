const { App, ExpressReceiver } = require('@slack/bolt');
const db = require('../db');
const flow = require('../services/flow');

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  endpoints: '/slack/events',
  // Bolt will auto-ack immediately (before our handler runs). Without this,
  // slow handlers cause Slack to retry and we get duplicate processing.
  processBeforeResponse: false,
});

const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
});

// ---------- helpers ----------

async function cacheConversation(client, userId) {
  try {
    const resp = await client.conversations.open({ users: userId });
    const channelId = resp.channel?.id;
    if (!channelId) return;
    await db.query(
      `INSERT INTO slack_conversation_refs (slack_user_id, channel_id, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (slack_user_id)
       DO UPDATE SET channel_id = EXCLUDED.channel_id, updated_at = NOW()`,
      [userId, channelId]
    );
  } catch (err) {
    console.error('Slack cacheConversation failed', err);
  }
}

async function findAllEmployeesBySlackId(slackUserId) {
  const { rows } = await db.query(
    `SELECT e.*, c.name AS category_name FROM employees e
       LEFT JOIN employee_categories c ON c.id = e.category_id
      WHERE e.slack_user_id = $1 AND e.is_active = TRUE`,
    [slackUserId]
  );
  return rows;
}

/**
 * When one Slack user is mapped to multiple employee rows (common during
 * testing when you impersonate every role), pick the row that currently
 * has pending work, in role priority order:
 *   employee → manager → delivery_head → hr
 * Falls back to the first row if none have pending work.
 */
async function pickActiveRole(slackUserId) {
  const candidates = await findAllEmployeesBySlackId(slackUserId);
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  const priority = ['employee', 'manager', 'delivery_head', 'hr'];
  const byRole = Object.fromEntries(candidates.map((r) => [r.role, r]));

  for (const role of priority) {
    const row = byRole[role];
    if (!row) continue;
    if (await hasPendingWork(row)) return row;
  }
  // Nothing pending — return highest-priority row anyway so "status" works
  for (const role of priority) if (byRole[role]) return byRole[role];
  return candidates[0];
}

/**
 * Lightweight check — does this user have anything to do in the active cycle?
 * Delegates to findPendingWork so the two stay in sync.
 */
async function hasPendingWork(user) {
  return (await flow.findPendingWork(user)) !== null;
}

function helpText() {
  return [
    '*Appraisal Bot — help*',
    '',
    '• Click *Start* on any reminder I send to begin the task',
    '• `status` — see your role / any pending work',
    '• `cancel` — abandon the current flow',
    '• `help`   — show this message',
  ].join('\n');
}

async function statusText(slackUserId) {
  const candidates = await findAllEmployeesBySlackId(slackUserId);
  if (!candidates.length) return 'I don\'t see you in the employee directory yet. Please check with HR.';
  if (candidates.length === 1) {
    return `Hi *${candidates[0].name}* — you're registered as *${candidates[0].role}*.\nType *start* to begin any pending task.`;
  }
  const active = await pickActiveRole(slackUserId);
  const list = candidates.map((c) =>
    `• ${c.name} (*${c.role}*)${active && c.id === active.id ? ' ← currently acting as this' : ''}`
  ).join('\n');
  return [
    'You are mapped to multiple roles (test mode):',
    list,
    'Type *start* and I\'ll pick whichever has pending work next.',
  ].join('\n');
}

// ---------- message handler ----------

slackApp.message(async ({ message, say, client, context }) => {
  if (message.subtype || message.bot_id) return;

  if (context.retryNum !== undefined && context.retryNum > 0) {
    console.log(`[slack] ignoring retry (num=${context.retryNum}, reason=${context.retryReason})`);
    return;
  }

  const slackUserId = message.user;
  await cacheConversation(client, slackUserId);

  const user = await pickActiveRole(slackUserId);
  if (!user) {
    await say('I don\'t see you in the employee directory yet. Please check with HR.');
    return;
  }

  const text = (message.text || '').trim();
  const lower = text.toLowerCase();

  // static commands first
  if (['hi', 'hello', 'help'].includes(lower)) {
    await say(helpText());
    return;
  }
  if (lower === 'status') {
    await say(await statusText(slackUserId));
    return;
  }
  // Note: "start" no longer works as a typed command — use the Start button
  // in the nudge message. Continue to flow service for in-progress sessions.

  const result = await flow.handleIncoming({ user, channel: 'slack' }, text);
  if (result && result.messages) {
    for (const m of result.messages) {
      try {
        if (typeof m === 'string') {
          const trimmed = m.trim();
          if (!trimmed) {
            console.warn('[slack] skipping empty string message');
            continue;
          }
          await say(trimmed);
        } else if (m && typeof m === 'object') {
          if (!m.text || !m.text.trim()) {
            console.warn('[slack] skipping object message with empty text', m);
            continue;
          }
          await say(m);
        }
      } catch (err) {
        console.error('[slack] say() failed for message:', JSON.stringify(m)?.slice(0, 200), err.message);
      }
    }
    return;
  }

  await say('I didn\'t understand that. Click *Start* on a reminder to begin, or type *help*.');
});

/**
 * Handle the "Start" button click from a nudge.
 * Acks immediately, then runs the same flow as a `start` command would.
 */
slackApp.action('start_appraisal', async ({ ack, body, client }) => {
  await ack();

  const slackUserId = body.user?.id;
  const channelId   = body.channel?.id;
  if (!slackUserId || !channelId) return;

  const user = await pickActiveRole(slackUserId);
  if (!user) {
    await client.chat.postMessage({
      channel: channelId,
      text: 'I don\'t see you in the employee directory yet. Please check with HR.',
    });
    return;
  }

  const result = await flow.handleIncoming({ user, channel: 'slack' }, 'start');
  if (result && result.messages) {
    for (const m of result.messages) {
      try {
        if (typeof m === 'string') {
          const trimmed = m.trim();
          if (!trimmed) continue;
          await client.chat.postMessage({ channel: channelId, text: trimmed });
        } else if (m && typeof m === 'object' && m.text && m.text.trim()) {
          await client.chat.postMessage({ channel: channelId, ...m });
        }
      } catch (err) {
        console.error('[slack] start_appraisal send failed:', err.message);
      }
    }
  }
});

// Cache DM channel when the user opens the bot's Home tab
slackApp.event('app_home_opened', async ({ event, client }) => {
  await cacheConversation(client, event.user);
});

module.exports = { slackApp, receiver };