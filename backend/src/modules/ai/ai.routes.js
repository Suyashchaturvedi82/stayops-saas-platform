const express = require('express');
const db = require('../../config/db');
const authSaasMiddleware = require('../../middleware/authSaasMiddleware');

const router = express.Router();
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

function isOperator(roles = []) {
  return roles.some((role) => ['OWNER', 'MANAGER', 'ACCOUNTANT', 'FRONTDESK'].includes(role));
}

async function loadContext(req) {
  const tenantId = req.tenant.id;
  const operator = isOperator(req.auth.roles);
  const common = [tenantId];

  const [occupancy, payments, maintenance, meals] = await Promise.all([
    db.execute(
      `SELECT COUNT(*) AS totalBeds,
              SUM(CASE WHEN is_available = 1 THEN 1 ELSE 0 END) AS availableBeds,
              SUM(CASE WHEN is_available = 0 THEN 1 ELSE 0 END) AS occupiedBeds
       FROM beds WHERE tenant_id = ?`, common
    ),
    db.execute(
      `SELECT
         SUM(CASE WHEN payment_status = 'PENDING' THEN 1 ELSE 0 END) AS pendingCount,
         SUM(CASE WHEN payment_status = 'PENDING' THEN amount ELSE 0 END) AS pendingAmount,
         SUM(CASE WHEN payment_status = 'VERIFIED' AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN amount ELSE 0 END) AS last30Revenue
       FROM payments WHERE tenant_id = ? ${operator ? '' : 'AND user_id = ?'}`,
      operator ? [tenantId] : [tenantId, req.auth.userId]
    ),
    db.execute(
      `SELECT COUNT(*) AS openCount,
              SUM(CASE WHEN priority IN ('URGENT','HIGH') AND status IN ('OPEN','IN_PROGRESS') THEN 1 ELSE 0 END) AS criticalOpen
       FROM maintenance_tickets WHERE tenant_id = ? ${operator ? '' : 'AND user_id = ?'}`,
      operator ? [tenantId] : [tenantId, req.auth.userId]
    ),
    db.execute(
      `SELECT COUNT(*) AS mealsToday FROM mess_daily_logs
       WHERE tenant_id = ? AND meal_date = CURDATE() ${operator ? '' : 'AND user_id = ?'}`,
      operator ? [tenantId] : [tenantId, req.auth.userId]
    ),
  ]);

  const o = occupancy[0][0];
  const p = payments[0][0];
  const m = maintenance[0][0];
  const meal = meals[0][0];

  return {
    workspace: req.tenant.name,
    role_scope: operator ? 'operator' : 'resident',
    occupancy: {
      total_beds: Number(o.totalBeds || 0),
      available_beds: Number(o.availableBeds || 0),
      occupied_beds: Number(o.occupiedBeds || 0),
    },
    payments: {
      pending_count: Number(p.pendingCount || 0),
      pending_amount: Number(p.pendingAmount || 0),
      last_30_day_verified_revenue: Number(p.last30Revenue || 0),
    },
    maintenance: {
      open_count: Number(m.openCount || 0),
      critical_open: Number(m.criticalOpen || 0),
    },
    meals: { meals_today: Number(meal.mealsToday || 0) },
  };
}

function localAnswer(message, ctx) {
  const q = message.toLowerCase();
  const occupancyRate = ctx.occupancy.total_beds
    ? Math.round((ctx.occupancy.occupied_beds / ctx.occupancy.total_beds) * 100)
    : 0;

  if (/vacant|available beds|free bed/.test(q)) {
    return `There are ${ctx.occupancy.available_beds} vacant beds out of ${ctx.occupancy.total_beds} total beds.`;
  }
  if (/occupancy|occupied/.test(q)) {
    return `Current occupancy is ${occupancyRate}% (${ctx.occupancy.occupied_beds}/${ctx.occupancy.total_beds} beds occupied).`;
  }
  if (/due|pending payment|arrear|outstanding/.test(q)) {
    return `I can see ${ctx.payments.pending_count} pending payments totalling ₹${ctx.payments.pending_amount.toLocaleString('en-IN')}.`;
  }
  if (/revenue|collection|collected/.test(q)) {
    return `Verified payment volume for the last 30 days is ₹${ctx.payments.last_30_day_verified_revenue.toLocaleString('en-IN')}.`;
  }
  if (/complaint|maintenance|ticket|repair|issue/.test(q)) {
    return `There are ${ctx.maintenance.open_count} open maintenance tickets, including ${ctx.maintenance.critical_open} high/urgent tickets.`;
  }
  if (/meal|mess|food/.test(q)) {
    return `There have been ${ctx.meals.meals_today} meal logs today${ctx.role_scope === 'resident' ? ' for your account' : ''}.`;
  }

  return `I can help with occupancy, vacant beds, dues, revenue, maintenance tickets and today's mess activity. Ask a specific operational question and I’ll use live workspace data.`;
}

async function askGemini(message, history, context) {
  if (!GEMINI_KEY) return null;

  const system = `You are StayOps AI, the operations copilot for a PG/hostel management SaaS.\n` +
    `Answer using the supplied live workspace context only. Do not invent resident identities, balances, or actions. ` +
    `Keep answers concise and operational. Never expose secrets or API keys.\n\nLIVE CONTEXT:\n${JSON.stringify(context)}`;

  const contents = [
    { role: 'user', parts: [{ text: system }] },
    ...(Array.isArray(history) ? history.slice(-8).map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(turn.content || '').slice(0, 2000) }],
    })) : []),
    { role: 'user', parts: [{ text: message.slice(0, 4000) }] },
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_KEY,
      },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Gemini request failed (${response.status})`);
    error.providerBody = body.slice(0, 500);
    throw error;
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || null;
}

router.get('/status', authSaasMiddleware, (req, res) => {
  res.json({
    provider: GEMINI_KEY ? 'gemini' : 'local',
    model: GEMINI_KEY ? MODEL : null,
    configured: Boolean(GEMINI_KEY),
  });
});

router.post('/chat', authSaasMiddleware, async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ message: 'Message is required.' });
    }

    const context = await loadContext(req);
    const local = localAnswer(message.trim(), context);
    let answer = local;
    let source = 'workspace-tools';

    // For broad questions, use Gemini if configured; direct operational questions stay fast/local.
    const isBroad = !/vacant|available|occupancy|occupied|due|pending|arrear|outstanding|revenue|collection|complaint|maintenance|ticket|repair|issue|meal|mess|food/i.test(message);
    if (isBroad && GEMINI_KEY) {
      try {
        const modelAnswer = await askGemini(message.trim(), history, context);
        if (modelAnswer) {
          answer = modelAnswer;
          source = 'gemini-grounded';
        }
      } catch (providerError) {
        console.warn('AI provider unavailable; using local fallback:', providerError.message);
      }
    }

    res.json({ answer, source, provider: GEMINI_KEY ? 'gemini' : 'local', context });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
