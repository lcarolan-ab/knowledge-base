// sharepoint.js — read the catalogue from a SharePoint document library.
//
// The user signs in with their own Microsoft account (MSAL, popup), and the page
// calls Microsoft Graph with a delegated token. So a visitor only ever sees the
// deliverables SharePoint already lets them open; nothing here widens access.
//
// Library shape expected (see docs/sharepoint-setup.md): one file per deliverable,
// with metadata columns for type, audiences, topics, client, date, summary, outline,
// and optionally author name / role / email. Author falls back to Created By.

const MSAL_URL = 'https://cdn.jsdelivr.net/npm/@azure/msal-browser@3/+esm';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPES = ['Sites.Read.All'];

export const DEFAULT_COLUMNS = {
  type: 'DeliverableType', audiences: 'Audiences', topics: 'Topics', client: 'Client',
  date: 'DeliveredOn', pages: 'Pages', summary: 'Summary', outline: 'Outline',
  authorName: 'AuthorName', authorRole: 'AuthorRole', authorEmail: 'AuthorEmail',
  contributors: 'Contributors',
};

const FORMAT_BY_EXT = { pptx: 'slides', ppt: 'slides', key: 'slides', pdf: 'pdf',
  xlsx: 'spreadsheet', xls: 'spreadsheet', csv: 'spreadsheet', docx: 'document', doc: 'document', md: 'document' };

let _msal = null;
async function msalApp(cfg) {
  if (_msal) return _msal;
  const lib = await import(/* @vite-ignore */ MSAL_URL);
  const app = new lib.PublicClientApplication({
    auth: {
      clientId: cfg.clientId,
      authority: `https://login.microsoftonline.com/${cfg.tenantId || 'organizations'}`,
      redirectUri: location.origin + location.pathname,
    },
    cache: { cacheLocation: 'sessionStorage' },
  });
  await app.initialize();
  await app.handleRedirectPromise();
  _msal = app;
  return app;
}

export async function signIn(cfg) {
  const app = await msalApp(cfg);
  let account = app.getAllAccounts()[0];
  if (!account) account = (await app.loginPopup({ scopes: SCOPES })).account;
  try {
    return (await app.acquireTokenSilent({ scopes: SCOPES, account })).accessToken;
  } catch {
    return (await app.acquireTokenPopup({ scopes: SCOPES, account })).accessToken;
  }
}

export async function signOut(cfg) {
  const app = await msalApp(cfg);
  const account = app.getAllAccounts()[0];
  if (account) await app.logoutPopup({ account });
}

async function graph(token, url) {
  const res = await fetch(url.startsWith('http') ? url : GRAPH + url,
    { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Graph ${res.status} on ${url.replace(GRAPH, '')}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ------------------------------------------------------------- mapping

const list = v => Array.isArray(v) ? v.map(String).map(s => s.trim()).filter(Boolean)
  : String(v || '').split(/[;\n|]/).map(s => s.trim()).filter(Boolean);
const CONTRIB_RE = /^\s*(.+?)\s*<([^>]+)>\s*$/;

// Pure: a Graph driveItem (expanded with listItem.fields) → a catalogue item.
export function mapDriveItem(di, columns = DEFAULT_COLUMNS) {
  const f = di.listItem?.fields || {};
  const col = k => f[columns[k] || DEFAULT_COLUMNS[k]];
  const name = di.name || '';
  const ext = (name.split('.').pop() || '').toLowerCase();
  const created = di.createdBy?.user || {};
  const date = String(col('date') || di.createdDateTime || '').slice(0, 7);
  return {
    id: name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || di.id,
    title: f.Title || name.replace(/\.[^.]+$/, ''),
    type: String(col('type') || ''),
    audiences: list(col('audiences')),
    topics: list(col('topics')),
    client: String(col('client') || ''),
    date,
    format: FORMAT_BY_EXT[ext] || 'document',
    pages: Number(col('pages')) || 0,
    file: di.webUrl || '',
    author: {
      name: String(col('authorName') || created.displayName || ''),
      role: String(col('authorRole') || ''),
      email: String(col('authorEmail') || created.email || ''),
    },
    contributors: list(col('contributors')).map(c => {
      const m = c.match(CONTRIB_RE);
      return m ? { name: m[1], email: m[2] } : { name: c, email: '' };
    }),
    summary: String(col('summary') || ''),
    outline: String(col('outline') || '').split('\n').map(s => s.replace(/^[-*]\s*/, '').trim()).filter(Boolean),
    source: di.webUrl || '',
    modified: di.lastModifiedDateTime || '',
  };
}

// ------------------------------------------------------------- loading

export async function loadCatalogue(cfg) {
  for (const k of ['clientId', 'siteHostname', 'sitePath', 'libraryName'])
    if (!cfg[k]) throw new Error(`SharePoint config is missing '${k}' (app/config.js).`);
  const token = await signIn(cfg);
  const site = await graph(token, `/sites/${cfg.siteHostname}:/${cfg.sitePath.replace(/^\/+/, '')}`);
  const drives = await graph(token, `/sites/${site.id}/drives`);
  const drive = (drives.value || []).find(d => d.name === cfg.libraryName);
  if (!drive) throw new Error(`No document library named '${cfg.libraryName}' on that site. ` +
    `Libraries found: ${(drives.value || []).map(d => d.name).join(', ') || 'none'}.`);

  const items = [];
  let url = `/drives/${drive.id}/root/children?$top=200&$expand=listItem($expand=fields)`;
  while (url) {
    const page = await graph(token, url);
    for (const di of page.value || []) if (di.file) items.push(mapDriveItem(di, cfg.columns));
    url = page['@odata.nextLink'] || null;
  }
  items.sort((a, b) => b.date.localeCompare(a.date));
  return { items, source: `SharePoint · ${cfg.libraryName}`, siteUrl: site.webUrl };
}
