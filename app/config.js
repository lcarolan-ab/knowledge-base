// config.js — deployment settings. Plain script, loaded before app.js.
//
// The demo reads data/library.json. To read a SharePoint document library instead,
// set source to "sharepoint" and fill in the block below. See docs/sharepoint-setup.md.
window.LIBRARY_CONFIG = {
  source: 'demo',                 // 'demo' | 'sharepoint'

  sharepoint: {
    tenantId: '',                 // Entra tenant id (GUID) or 'organizations'
    clientId: '',                 // app registration (SPA) client id
    siteHostname: '',             // e.g. 'contoso.sharepoint.com'
    sitePath: '',                 // e.g. 'sites/ClientAnalytics'
    libraryName: 'Deliverables',  // the document library's display name
    // Column internal names in that library. Multi-value columns may be
    // multi-choice or semicolon-separated text. Author falls back to the
    // file's Created By when the author columns are empty.
    columns: {
      type: 'DeliverableType', audiences: 'Audiences', topics: 'Topics',
      client: 'Client', date: 'DeliveredOn', pages: 'Pages',
      summary: 'Summary', outline: 'Outline',
      authorName: 'AuthorName', authorRole: 'AuthorRole', authorEmail: 'AuthorEmail',
      contributors: 'Contributors',
    },
  },

  model: {
    mode: 'demo',                 // default backend until the visitor changes it: 'demo' | 'proxy' | 'direct'
    proxyUrl: '/api/ask',         // used when mode is 'proxy'; Azure Static Web Apps serves the function here
  },
};
