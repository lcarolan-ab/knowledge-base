// provider.js — the model, reached over the network.
//
// Three modes, chosen at runtime:
//
//   demo    no model. The deterministic search answers. No key, no network.
//   direct  the browser calls the Claude API itself with the visitor's own key.
//           Only viable on static hosting. The key is readable by anyone with
//           devtools on that device, so this is for personal use only.
//   proxy   POST to your own endpoint, which holds the key server-side. This is
//           the real-deployment path — see proxy/worker.js.
//
// Live modes get the whole catalogue (it is small) and must reply with JSON naming
// the deliverables that answer the question. The search's own results are always
// the fallback, so a bad model reply degrades to demo-mode behaviour, never to nothing.

const MODEL = 'claude-opus-5';
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm';

let _sdk = null;
async function loadSDK() {
  if (_sdk) return _sdk;
  _sdk = (await import(/* @vite-ignore */ SDK_URL)).default;
  return _sdk;
}

export const KEY_STORAGE = 'library.apiKey';
export const MODE_STORAGE = 'library.mode';
export const PROXY_STORAGE = 'library.proxyUrl';

const get = (k, d = '') => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const set = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };
export const getMode = () => get(MODE_STORAGE, 'demo');
export const setMode = m => set(MODE_STORAGE, m);
export const getKey = () => get(KEY_STORAGE);
export const setKey = k => set(KEY_STORAGE, k.trim());
export const getProxy = () => get(PROXY_STORAGE);
export const setProxy = u => set(PROXY_STORAGE, u.trim());

// ------------------------------------------------------------------- prompt

function catalogue(data) {
  return data.items.map(it =>
    `- id: ${it.id}\n  title: ${it.title}\n  type: ${it.type}\n  audiences: ${it.audiences.join(', ')}\n` +
    `  topics: ${it.topics.join(', ')}\n  client: ${it.client}\n  date: ${it.date}\n` +
    `  author: ${it.author.name} (${it.author.role}, ${it.author.email})\n` +
    (it.contributors.length ? `  contributors: ${it.contributors.map(c => `${c.name} (${c.email})`).join(', ')}\n` : '') +
    `  summary: ${it.summary}`).join('\n');
}

export function askPrompt(question, data) {
  return {
    system: `You answer questions about a firm's library of deliverables — the analyses,
projections, summaries and memos its teams have already produced for clients. People ask
things like "have we ever done a credit card analysis for a new grad?" and want two
things back: the existing deliverables that fit, and the person to contact about them.

Rules:
- Use ONLY the catalogue below. Never invent a deliverable, an author or a figure.
- Interpret the question generously: "new grad", "recent graduate", "first job" and
  "entry level" describe the same audience; a deliverable for a closely related audience
  or type is worth surfacing, but say that it is close rather than exact.
- Prefer the most recent and most specific match. Reusable templates count.
- If nothing fits, say so plainly and name the nearest related work, if any.
- The author is the contact. Mention them by name in the answer.

Reply with ONLY a JSON object, no prose before or after:
{"answer": "2 to 4 plain sentences for the person asking",
 "matches": [{"id": "<catalogue id>", "reason": "why this fits, in a few words"}]}
List matches best first, at most 6. An empty list is a valid reply.

Catalogue (${data.items.length} deliverables):
${catalogue(data)}`,
    user: question,
  };
}

export function parseReply(text, data) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, error: 'No JSON object in the reply.', text };
  try {
    const obj = JSON.parse(m[0]);
    if (typeof obj.answer !== 'string' || !Array.isArray(obj.matches)) throw new Error('missing answer or matches');
    const byId = new Map(data.items.map(i => [i.id, i]));
    const matches = obj.matches
      .map(x => ({ item: byId.get(x.id), reason: String(x.reason || '') }))
      .filter(x => x.item);
    return { ok: true, answer: obj.answer.trim(), matches };
  } catch (e) {
    return { ok: false, error: `Could not parse the reply: ${e.message}`, text };
  }
}

// --------------------------------------------------------------- transports

async function direct({ system, user, signal }) {
  const Anthropic = await loadSDK();
  const apiKey = getKey();
  if (!apiKey) throw new Error('No API key set. Open Settings and add one.');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const stream = client.messages.stream({
    model: MODEL, max_tokens: 4000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    system, messages: [{ role: 'user', content: user }],
  }, { signal });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('The model declined this request.');
  return msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

async function proxy({ system, user, signal }) {
  const url = getProxy();
  if (!url) throw new Error('No proxy URL set. Open Settings and add one.');
  const res = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ system, user, max_tokens: 4000, model: MODEL }), signal,
  });
  if (!res.ok) throw new Error(`Proxy returned ${res.status}: ${await res.text()}`);
  const ctype = res.headers.get('content-type') || '';
  if (ctype.includes('application/json')) {
    const d = await res.json();
    return d.text ?? d.content?.[0]?.text ?? '';
  }
  return await res.text();
}

// Returns null in demo mode; otherwise the raw model text.
export async function ask({ question, data, signal }) {
  const mode = getMode();
  if (mode === 'demo') return null;
  const { system, user } = askPrompt(question, data);
  return mode === 'proxy' ? proxy({ system, user, signal }) : direct({ system, user, signal });
}

export { MODEL };
