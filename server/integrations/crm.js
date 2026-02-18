/**
 * CRM Integration Layer
 * Supports: Salesforce, HubSpot, Zoho, Pipedrive
 * Dispatches lead data + conversation events to configured CRM(s)
 */
const { logger } = require('../utils/logger');
const { redis } = require('../utils/redis');
const { db } = require('../utils/db');

// ─── CRM Adapter Interface ───
class CRMAdapter {
  constructor(config) { this.config = config; }
  async createContact(lead) { throw new Error('Not implemented'); }
  async createDeal(lead, conversation) { throw new Error('Not implemented'); }
  async logActivity(event) { throw new Error('Not implemented'); }
  async test() { throw new Error('Not implemented'); }
}

// ─── Salesforce ───
class SalesforceAdapter extends CRMAdapter {
  async getToken() {
    const cached = await redis.get('crm:sf:token');
    if (cached) return cached;

    const res = await fetch(`${this.config.instanceUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });
    const data = await res.json();
    await redis.set('crm:sf:token', data.access_token, 3500);
    return data.access_token;
  }

  async createContact(lead) {
    const token = await this.getToken();
    const res = await fetch(`${this.config.instanceUrl}/services/data/v59.0/sobjects/Lead`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        FirstName: lead.name?.split(' ')[0],
        LastName: lead.name?.split(' ').slice(1).join(' ') || lead.name,
        Email: lead.email,
        Phone: lead.phone,
        Company: lead.company || 'Unknown',
        LeadSource: 'Chatbot Widget',
        Description: lead.notes,
      }),
    });
    const data = await res.json();
    logger.info(`Salesforce lead created: ${data.id}`);
    return data;
  }

  async createDeal(lead, conversation) {
    const token = await this.getToken();
    const res = await fetch(`${this.config.instanceUrl}/services/data/v59.0/sobjects/Opportunity`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Name: `Chatbot Lead - ${lead.name}`,
        StageName: 'Qualification',
        CloseDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        Description: `Business Line: ${lead.business_line}\nLanguage: ${lead.language}\nConversation ID: ${conversation?.id}`,
      }),
    });
    return res.json();
  }

  async test() {
    const token = await this.getToken();
    return !!token;
  }
}

// ─── HubSpot ───
class HubSpotAdapter extends CRMAdapter {
  get headers() {
    return { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' };
  }

  async createContact(lead) {
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        properties: {
          firstname: lead.name?.split(' ')[0],
          lastname: lead.name?.split(' ').slice(1).join(' ') || '',
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          hs_lead_status: 'NEW',
          lifecyclestage: 'lead',
          chatbot_business_line: lead.business_line,
          chatbot_language: lead.language,
          chatbot_quality_score: String(lead.quality_score || 0),
        },
      }),
    });
    const data = await res.json();
    logger.info(`HubSpot contact created: ${data.id}`);
    return data;
  }

  async createDeal(lead) {
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        properties: {
          dealname: `Chatbot Lead - ${lead.name}`,
          dealstage: 'qualifiedtobuy',
          pipeline: 'default',
          chatbot_business_line: lead.business_line,
        },
      }),
    });
    return res.json();
  }

  async logActivity(event) {
    await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        properties: {
          hs_note_body: `Chatbot event: ${event.type}\n${JSON.stringify(event.data, null, 2)}`,
          hs_timestamp: new Date().toISOString(),
        },
      }),
    });
  }

  async test() {
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', { headers: this.headers });
    return res.ok;
  }
}

// ─── Zoho CRM ───
class ZohoAdapter extends CRMAdapter {
  async getToken() {
    const cached = await redis.get('crm:zoho:token');
    if (cached) return cached;

    const res = await fetch(`${this.config.accountsUrl || 'https://accounts.zoho.com'}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });
    const data = await res.json();
    await redis.set('crm:zoho:token', data.access_token, 3500);
    return data.access_token;
  }

  async createContact(lead) {
    const token = await this.getToken();
    const res = await fetch(`${this.config.apiUrl || 'https://www.zohoapis.com'}/crm/v5/Leads`, {
      method: 'POST',
      headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          First_Name: lead.name?.split(' ')[0],
          Last_Name: lead.name?.split(' ').slice(1).join(' ') || lead.name,
          Email: lead.email,
          Phone: lead.phone,
          Company: lead.company || 'Unknown',
          Lead_Source: 'Chatbot Widget',
          Description: `Business Line: ${lead.business_line}, Language: ${lead.language}`,
        }],
      }),
    });
    const data = await res.json();
    logger.info(`Zoho lead created: ${data.data?.[0]?.details?.id}`);
    return data;
  }

  async test() {
    const token = await this.getToken();
    return !!token;
  }
}

// ─── Pipedrive ───
class PipedriveAdapter extends CRMAdapter {
  get base() { return `https://${this.config.domain}.pipedrive.com/api/v1`; }
  get auth() { return `api_token=${this.config.apiKey}`; }

  async createContact(lead) {
    // Create person
    const personRes = await fetch(`${this.base}/persons?${this.auth}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: lead.name,
        email: [{ value: lead.email, primary: true }],
        phone: lead.phone ? [{ value: lead.phone, primary: true }] : [],
        org_id: null,
      }),
    });
    const personData = await personRes.json();
    logger.info(`Pipedrive person created: ${personData.data?.id}`);
    return personData;
  }

  async createDeal(lead) {
    const dealRes = await fetch(`${this.base}/deals?${this.auth}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Chatbot Lead - ${lead.name}`,
        status: 'open',
      }),
    });
    return dealRes.json();
  }

  async test() {
    const res = await fetch(`${this.base}/users/me?${this.auth}`);
    return res.ok;
  }
}

// ─── Factory ───
const ADAPTERS = {
  salesforce: SalesforceAdapter,
  hubspot: HubSpotAdapter,
  zoho: ZohoAdapter,
  pipedrive: PipedriveAdapter,
};

function createAdapter(type, config) {
  const Cls = ADAPTERS[type];
  if (!Cls) throw new Error(`Unknown CRM type: ${type}`);
  return new Cls(config);
}

// ─── Main dispatch function ───
async function dispatchToCRM(event, data) {
  const configRow = await db.getConfig('crm_integrations');
  if (!configRow) return;

  const integrations = Array.isArray(configRow) ? configRow : [configRow];

  for (const integration of integrations) {
    if (!integration.enabled) continue;
    try {
      const adapter = createAdapter(integration.type, integration.config);
      switch (event) {
        case 'lead_created':
          await adapter.createContact(data.lead);
          if (integration.createDeal) await adapter.createDeal(data.lead, data.conversation);
          break;
        case 'conversation_closed':
          if (integration.logActivities) await adapter.logActivity({ type: event, data });
          break;
      }
      logger.info(`CRM ${integration.type}: ${event} dispatched`);
    } catch (e) {
      logger.error(`CRM ${integration.type} error:`, e.message);
    }
  }
}

module.exports = { createAdapter, dispatchToCRM, ADAPTERS };
