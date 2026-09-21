// ask.js — POST /api/ask
//
// Runs as a managed function of the Azure Static Web App. Static Web Apps only
// forwards requests here after its own authentication, and it injects the caller's
// identity as the x-ms-client-principal header; we refuse anything without one.
// The Anthropic key lives in the app's settings (or a Key Vault reference), never in
// the browser. The model is fixed here so a caller cannot pick a costlier one.

const { app } = require('@azure/functions');
const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-opus-5';
const MAX_SYSTEM = 200_000;   // characters; the catalogue prompt is a few thousand
const MAX_USER = 4_000;
const LIMIT = { calls: 40, perMs: 10 * 60 * 1000 };
const usage = new Map();      // per-instance rate limit: userId → [timestamps]

function principal(req) {
  const raw = req.headers.get('x-ms-client-principal');
  if (!raw) return null;
  try { return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); } catch { return null; }
}

function overLimit(userId) {
  const now = Date.now();
  const list = (usage.get(userId) || []).filter(t => now - t < LIMIT.perMs);
  list.push(now);
  usage.set(userId, list);
  return list.length > LIMIT.calls;
}

app.http('ask', {
  methods: ['POST'],
  authLevel: 'anonymous',       // SWA's route rule requires an authenticated role
  handler: async (req, ctx) => {
    const who = principal(req);
    if (!who?.userId) return { status: 401, jsonBody: { error: 'Sign in first.' } };
    if (overLimit(who.userId)) return { status: 429, jsonBody: { error: 'Too many questions; try again in a few minutes.' } };
    if (!process.env.ANTHROPIC_API_KEY) return { status: 500, jsonBody: { error: 'ANTHROPIC_API_KEY is not configured.' } };

    let body;
    try { body = await req.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }
    const { system, user } = body || {};
    if (typeof system !== 'string' || typeof user !== 'string')
      return { status: 400, jsonBody: { error: 'system and user must be strings.' } };
    if (system.length > MAX_SYSTEM || user.length > MAX_USER)
      return { status: 413, jsonBody: { error: 'Prompt too large.' } };

    const client = new Anthropic();   // reads ANTHROPIC_API_KEY
    try {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: Math.min(Number(body.max_tokens) || 4000, 8000),
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        system,
        messages: [{ role: 'user', content: user }],
      });
      if (msg.stop_reason === 'refusal') return { status: 200, jsonBody: { text: '', refused: true } };
      const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
      ctx.log(`ask by ${who.userDetails || who.userId}: ${msg.usage?.input_tokens} in / ${msg.usage?.output_tokens} out`);
      return { jsonBody: { text } };
    } catch (e) {
      ctx.error(e);
      return { status: e.status || 502, jsonBody: { error: `Model call failed: ${e.message}` } };
    }
  },
});
