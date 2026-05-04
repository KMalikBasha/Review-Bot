const { TeamsActivityHandler, CardFactory, TurnContext } = require('botbuilder');
const db = require('../db');

/**
 * AppraisalBot
 * - Captures each user's ConversationReference the first time they interact,
 *   so we can proactively send nudges later.
 * - Responds to incoming messages with help / status text for now.
 * - The actual appraisal flows (questionnaire, feedback) plug in later.
 */
class AppraisalBot extends TeamsActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      await this._saveConversationRef(context);

      const text = (context.activity.text || '').trim().toLowerCase();

      if (text === 'help' || text === 'hi' || text === 'hello') {
        await context.sendActivity(this._helpText());
      } else if (text === 'status') {
        await context.sendActivity(await this._statusText(context));
      } else if (text === 'start') {
        await context.sendActivity({
          attachments: [this._startCard()],
        });
      } else {
        await context.sendActivity(
          `Got your message: "${context.activity.text}"\n\nType **help** to see what I can do.`
        );
      }

      await next();
    });

    // Fires when someone is added to a conversation with the bot
    this.onMembersAdded(async (context, next) => {
      await this._saveConversationRef(context);
      for (const member of context.activity.membersAdded || []) {
        if (member.id !== context.activity.recipient.id) {
          await context.sendActivity(
            `Hi! I'm the Appraisal Bot. I'll nudge you when there's something to do in the review cycle.\n\nType **help** for options.`
          );
        }
      }
      await next();
    });
  }

  /**
   * Persist a conversation reference keyed by teams user id so we can
   * send proactive messages later (nudges).
   */
  async _saveConversationRef(context) {
    try {
      const ref  = TurnContext.getConversationReference(context.activity);
      const aad  = context.activity.from?.aadObjectId;
      const uid  = aad || context.activity.from?.id;
      if (!uid) return;

      await db.query(
        `INSERT INTO bot_conversation_refs (teams_user_id, conversation_ref, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (teams_user_id)
         DO UPDATE SET conversation_ref = EXCLUDED.conversation_ref, updated_at = NOW()`,
        [uid, ref]
      );
    } catch (err) {
      console.error('Failed saving conversation ref', err);
    }
  }

  _helpText() {
    return [
      '**Appraisal Bot — help**',
      '',
      '- `status` — see pending actions assigned to you',
      '- `start`  — begin the current appraisal task',
      '- `help`   — show this message',
      '',
      'I\'ll also nudge you automatically when it\'s time to act.',
    ].join('\n');
  }

  async _statusText(context) {
    const aad = context.activity.from?.aadObjectId || context.activity.from?.id;
    const { rows } = await db.query(
      `SELECT id, name, role FROM employees WHERE teams_user_id = $1`,
      [aad]
    );
    if (!rows.length) {
      return 'I don\'t see you in the employee directory yet. Please check with HR.';
    }
    const emp = rows[0];
    return `Hi **${emp.name}** — you're registered as **${emp.role}**.\n\n_(Full status view coming soon.)_`;
  }

  _startCard() {
    return CardFactory.adaptiveCard({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        { type: 'TextBlock', size: 'Large', weight: 'Bolder', text: 'Start your appraisal' },
        { type: 'TextBlock', wrap: true, text: 'You have a pending appraisal task. Click below to begin.' },
      ],
      actions: [
        { type: 'Action.Submit', title: 'Begin', data: { action: 'begin_appraisal' } },
      ],
    });
  }
}

module.exports = { AppraisalBot };
