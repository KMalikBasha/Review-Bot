const { adapter } = require('./adapter');
const db = require('../db');

/**
 * Send a proactive message to a user by their teams_user_id (AAD object id).
 * Requires the user to have messaged the bot at least once (so we have a
 * conversation reference stored in bot_conversation_refs).
 *
 * @param {string} teamsUserId
 * @param {string|object} payload - string (plain text) or { text?, card? }
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function sendProactiveMessage(teamsUserId, payload) {
  const { rows } = await db.query(
    `SELECT conversation_ref FROM bot_conversation_refs WHERE teams_user_id = $1`,
    [teamsUserId]
  );
  if (!rows.length) {
    return { ok: false, reason: 'no_conversation_ref' };
  }

  const ref = rows[0].conversation_ref;

  try {
    await adapter.continueConversationAsync(
      process.env.MICROSOFT_APP_ID,
      ref,
      async (context) => {
        if (typeof payload === 'string') {
          await context.sendActivity(payload);
        } else {
          const activity = {};
          if (payload.text) activity.text = payload.text;
          if (payload.card) activity.attachments = [payload.card];
          await context.sendActivity(activity);
        }
      }
    );
    return { ok: true };
  } catch (err) {
    console.error('Proactive send failed', err);
    return { ok: false, reason: err.message };
  }
}

module.exports = { sendProactiveMessage };
