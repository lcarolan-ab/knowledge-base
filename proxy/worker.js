// worker.js — optional backend for the LLM wiki app.
//
// GitHub Pages is static, so the app's default mode asks each visitor for their
// own API key and calls Claude straight from the browser. That is fine for a
// personal tool and wrong for anything with real users: the key is readable by
// anyone with devtools on that device.
//
// This Worker is the fix. It holds the key server-side, so the page never sees
// one. Deploy it, then set the app to Proxy mode and paste its URL.
//
//   npm create cloudflare@latest -- llm-wiki-proxy
//   # replace src/index.js with this file
//   npx wrangler secret put ANTHROPIC_API_KEY
//   npx wrangler deploy
//
// Then in the app: Settings → Proxy → paste the deployed URL.
//
// Adapts to Vercel/Netlify/Deno Deploy with only the handler signature changed;
// the body is plain fetch against the Messages API.

const MODEL = 'claude-opus-5';
const API = 'https://api.anthropic.com/v1/messages';

// Lock this down before deploying. '*' lets any page spend your tokens.
const ALLOWED_ORIGINS = [
  'https://YOUR-USERNAME.github.io',
  'http://localhost:8765',
];

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'access-control-allow-origin': ok,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    const headers = cors(origin);

    if (request.method === 'OPTIONS') return new Response(null, { headers });
    if (request.method !== 'POST')
      return new Response('POST only', { status: 405, headers });
    if (origin && !ALLOWED_ORIGINS.includes(origin))
      return new Response('Origin not allowed', { status: 403, headers });

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400, headers });
    }

    const { system, user, max_tokens = 16000 } = body;
    if (typeof system !== 'string' || typeof user !== 'string')
      return new Response('system and user must be strings', { status: 400, headers });

    // The client never picks the model — it would be a way to spend your money
    // on something you did not choose.
    const upstream = await fetch(API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: Math.min(Number(max_tokens) || 16000, 32000),
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        system,
        messages: [{ role: 'user', content: user }],
        stream: true,
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return new Response(`Upstream ${upstream.status}: ${detail}`,
        { status: upstream.status, headers });
    }

    // Unwrap Anthropic's SSE into a plain text stream — that is what the app's
    // proxy transport reads, so the browser needs no SSE parser and no SDK.
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body.getReader();
        const dec = new TextDecoder();
        const enc = new TextEncoder();
        let buf = '';
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop();
            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const ev = JSON.parse(payload);
                if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta')
                  controller.enqueue(enc.encode(ev.delta.text));
              } catch { /* keep-alive or partial frame; ignore */ }
            }
          }
        } catch (e) {
          controller.enqueue(enc.encode(`\n\n[stream error: ${e.message}]`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' },
    });
  },
};
