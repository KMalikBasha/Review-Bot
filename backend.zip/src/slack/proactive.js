const { slackApp } = require('./app');
const db = require('../db');

/**
 * Send a proactive DM to a Slack user by their Slack user id.
 * Unlike Teams, Slack lets us open a DM channel anytime - we don't strictly
 * need a prior interaction. But we still cache the channel id to be efficient
 * and consistent with the Teams flow.
 *
 * @param {string} slackUserId   - e.g. "U01ABCD1234"
 * @param {string|object} payload - string (plain text) or { text, blocks }
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function sendSlackProactiveMessage(slackUserId, payload) {
  try {
    const client = slackApp.client;

    // Try cache first
    let channelId;
    const cached = await db.query(
      `SELECT channel_id FROM slack_conversation_refs WHERE slack_user_id = $1`,
      [slackUserId]
    );

    if (cached.rows.length) {
      channelId = cached.rows[0].channel_id;
    } else {
      // Open a DM on-demand and cache it
      const open = await client.conversations.open({ users: slackUserId });
      channelId = open.channel?.id;
      if (!channelId) return { ok: false, reason: 'could_not_open_dm' };

      await db.query(
        `INSERT INTO slack_conversation_refs (slack_user_id, channel_id, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (slack_user_id)
         DO UPDATE SET channel_id = EXCLUDED.channel_id, updated_at = NOW()`,
        [slackUserId, channelId]
      );
    }

    const msg = { channel: channelId };
    if (typeof payload === 'string') {
      msg.text = payload;
    } else {
      if (payload.text)        msg.text        = payload.text;
      if (payload.blocks)      msg.blocks      = payload.blocks;
      if (payload.attachments) msg.attachments = payload.attachments;
    }

    await client.chat.postMessage(msg);
    return { ok: true };
  } catch (err) {
    console.error('Slack proactive send failed', err);
    return { ok: false, reason: err.data?.error || err.message };
  }
}

module.exports = { sendSlackProactiveMessage };
