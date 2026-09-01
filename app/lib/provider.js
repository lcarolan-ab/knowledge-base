// provider.js — the compiler, reached over the network.
//
// Three modes, chosen at runtime:
//
//   demo    canned responses. No key, no network. The whole UI works.
//   direct  the browser calls the Claude API itself with the visitor's own key.
//           Only viable mode on GitHub Pages, which is static hosting: there is
//           no server to keep a secret in.
//   proxy   POST to your own endpoint, which holds the key server-side. This is
//           the deploy-later path — see proxy/worker.js. Nothing else changes.
//
// On `direct`: the official SDK refuses to run in a browser unless you pass
// dangerouslyAllowBrowser, because the key is visible to anyone with devtools.
// Anthropic scopes that as acceptable for internal/personal tools where the
// user supplies their own key — which is exactly this app. Never ship a build
// with YOUR key baked in; every visitor brings their own.

const MODEL = 'claude-opus-5';
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm';

let _sdk = null;
async function loadSDK() {
  if (_sdk) return _sdk;
  try {
    _sdk = (await import(/* @vite-ignore */ SDK_URL)).default;
    return _sdk;
  } catch (e) {
    throw new Error(
      'Could not load the Anthropic SDK from the CDN. Check your network, or ' +
      'vendor the SDK into the repo for offline use. (' + e.message + ')');
  }
}

export const KEY_STORAGE = 'llmwiki.apiKey';
export const MODE_STORAGE = 'llmwiki.mode';
export const PROXY_STORAGE = 'llmwiki.proxyUrl';

export function getMode() {
  try { return localStorage.getItem(MODE_STORAGE) || 'demo'; } catch { return 'demo'; }
}
export function setMode(m) { try { localStorage.setItem(MODE_STORAGE, m); } catch {} }
export function getKey() {
  try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
}
export function setKey(k) {
  try { k ? localStorage.setItem(KEY_STORAGE, k) : localStorage.removeItem(KEY_STORAGE); }
  catch {}
}
export function getProxy() {
  try { return localStorage.getItem(PROXY_STORAGE) || ''; } catch { return ''; }
}
export function setProxy(u) { try { localStorage.setItem(PROXY_STORAGE, u); } catch {} }

// ------------------------------------------------------------------- prompts

const RULES = `You are the compiler for an LLM wiki. Knowledge is compiled once
from raw sources into interlinked markdown pages and kept current — never
re-derived per question.

Non-negotiable rules:
- Every factual claim carries a citation [^source-id]. Your own reasoning across
  pages is cited [^synthesis] — that is honest, not an escape hatch.
- Only cite source ids that exist. Never invent one.
- Contradictions are content, not errors. When sources disagree, say so and name
  who claims what. Never average two sources into a compromise neither made, and
  never silently pick a winner.
- Page links are [[type/slug]] pointing at real pages.
- No numeric confidence scores. Status is categorical: established, contested,
  provisional, superseded.`;

function wikiContext(pages, limit = 40) {
  return pages.slice(0, limit).map(p =>
    `--- wiki/${p.slug}.md\ntitle: ${p.meta.title}\nstatus: ${p.meta.status}\n` +
    `sources: ${(p.meta.sources || []).join(', ')}\n\n${p.body}`).join('\n\n');
}

function sourceList(sources) {
  return sources.map(s =>
    `- ${s.id} — "${s.title}" (${s.author || 'unknown'}, ${s.published || 'n.d.'})`)
    .join('\n');
}

// --------------------------------------------------------------------- query

export function queryPrompt(question, pages, sources) {
  return {
    system: `${RULES}

You are answering from the COMPILED WIKI below. Rules for answering:
- Answer from these pages, not from your own background knowledge.
- Carry citations through from the pages you use.
- If the pages disagree, report it as contested and name both sides.
- If the wiki cannot answer, say so plainly and say which of these it is:
  (a) the source was never ingested, (b) it was ingested but the claim never
  made it onto a page, (c) no source covers this. Do NOT fill the gap from your
  own knowledge and present it as compiled — that is the one failure that makes
  a wiki untrustworthy.
- End with a line "PAGES USED: slug, slug" listing the pages you actually used.

Available source ids:
${sourceList(sources)}

=== COMPILED WIKI ===
${wikiContext(pages)}`,
    user: question,
  };
}

// -------------------------------------------------------------------- ingest

export function ingestPrompt(sourceText, meta, pages, sources) {
  return {
    system: `${RULES}

You are running the INGEST operation: folding one new source into an existing
wiki. Integration is the work — a new page is the exception. Expect to touch
many existing pages, not to file one new one.

For each page the source touches:
- fold the claim into the existing prose (do not append "a new source says...")
- add [^${meta.id}] where it is used, and add "${meta.id}" to that page's sources
- set updated to ${meta.added}
- ask explicitly whether the source CONTRADICTS what the page says. If it does,
  set status to contested and write or extend a "## Contradictions" section
  naming who claims what.

Existing source ids (you may cite these plus the new one, "${meta.id}"):
${sourceList(sources)}
- ${meta.id} — "${meta.title}" (THE NEW SOURCE)

Reply with a short plain-text explanation, then ONE fenced json block:

\`\`\`json
{
  "edits": [
    {"slug":"concepts/x","action":"update","title":"X","type":"concept",
     "status":"established","updated":"${meta.added}","sources":["a","b"],
     "body":"# X\\n\\nFull new markdown body...","note":"what changed and why"}
  ],
  "contradictions": ["one line per contradiction found, or empty"],
  "log": "one-line entry for wiki/log.md"
}
\`\`\`

"body" is the COMPLETE new markdown body of that page including its heading and
its trailing [^id]: footnote definition lines — not a diff. Keep every existing
claim unless the new source overturns it. action is "update" or "create".

=== COMPILED WIKI ===
${wikiContext(pages)}`,
    user: `New source to ingest.

id: ${meta.id}
title: ${meta.title}
author: ${meta.author || 'unknown'}
url: ${meta.url || 'n/a'}
published: ${meta.published || 'n.d.'}
capture: ${meta.capture}

--- content ---
${sourceText}`,
  };
}

// Parse the fenced json block out of a model reply. Deliberately prompt-based
// rather than structured outputs: this must degrade gracefully, and a bad parse
// should show the user the raw reply rather than throwing.
export function parseEdits(text) {
  const fence = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*(\{[\s\S]*?})\s*```/);
  const raw = fence ? fence[1] : (text.match(/\{[\s\S]*"edits"[\s\S]*\}/) || [])[0];
  if (!raw) return { ok: false, error: 'No JSON block found in the reply.', text };
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.edits)) throw new Error('"edits" is not an array');
    return { ok: true, data, text: text.replace(/```json[\s\S]*?```/i, '').trim() };
  } catch (e) {
    return { ok: false, error: `Could not parse the JSON block: ${e.message}`, text };
  }
}

// ---------------------------------------------------------------- transports

async function streamDirect({ system, user, maxTokens, onText, signal }) {
  const Anthropic = await loadSDK();
  const apiKey = getKey();
  if (!apiKey) throw new Error('No API key set. Open Settings and add one.');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system,
    messages: [{ role: 'user', content: user }],
  }, { signal });

  stream.on('text', t => onText?.(t));
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal')
    throw new Error('The model declined this request (stop_reason: refusal).');
  return msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

async function streamProxy({ system, user, maxTokens, onText, signal }) {
  const url = getProxy();
  if (!url) throw new Error('No proxy URL set. Open Settings and add one.');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ system, user, max_tokens: maxTokens, model: MODEL }),
    signal,
  });
  if (!res.ok) throw new Error(`Proxy returned ${res.status}: ${await res.text()}`);
  // Accepts either a plain-text stream or {text: "..."} JSON.
  const ctype = res.headers.get('content-type') || '';
  if (ctype.includes('application/json')) {
    const data = await res.json();
    const text = data.text ?? data.content?.[0]?.text ?? '';
    onText?.(text);
    return text;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = dec.decode(value, { stream: true });
    full += chunk;
    onText?.(chunk);
  }
  return full;
}

async function streamDemo({ demo, onText }) {
  for (const chunk of demo.match(/[\s\S]{1,24}/g) || []) {
    onText?.(chunk);
    await new Promise(r => setTimeout(r, 12));
  }
  return demo;
}

export async function run({ system, user, maxTokens = 16000, onText, signal, demo }) {
  const mode = getMode();
  if (mode === 'demo') return streamDemo({ demo: demo || 'No demo response.', onText });
  if (mode === 'proxy') return streamProxy({ system, user, maxTokens, onText, signal });
  return streamDirect({ system, user, maxTokens, onText, signal });
}

export { MODEL };
