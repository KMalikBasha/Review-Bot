const {
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  createBotFrameworkAuthenticationFromConfiguration,
} = require('botbuilder');

const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId:       process.env.MICROSOFT_APP_ID,
  MicrosoftAppPassword: process.env.MICROSOFT_APP_PASSWORD,
  MicrosoftAppType:     process.env.MICROSOFT_APP_TYPE || 'MultiTenant',
  MicrosoftAppTenantId: process.env.MICROSOFT_APP_TENANT_ID,
});

const botAuth = createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);
const adapter = new CloudAdapter(botAuth);

// Surface turn errors clearly in dev
adapter.onTurnError = async (context, error) => {
  console.error('[onTurnError]', error);
  try { await context.sendActivity('Sorry, something went wrong on my end.'); } catch {}
};

module.exports = { adapter };
