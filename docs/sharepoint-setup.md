# Connecting the app to a SharePoint library

The app can read its catalogue straight from a SharePoint document library instead of
the bundled demo file. Each visitor signs in with their own Microsoft account, and the
page calls Microsoft Graph with that user's permissions, so nobody sees a deliverable
SharePoint would not already let them open.

> **Not yet run against a live tenant.** The connector (`app/lib/sharepoint.js`) is
> written against the documented Graph shapes and its mapping is unit-tested
> (`node tools/test_app.mjs`), but it was built without access to a SharePoint
> tenant. Expect to spend an hour on the first connection: the likely snags are the
> redirect URI, admin consent, and a column internal name that differs from its
> display name.

## 1. The document library

Create (or pick) a document library, one file per deliverable, and add these columns.
Internal names matter: SharePoint derives the internal name from the display name at
creation, so create the column with the internal name first and rename its display
name afterwards, or set the names in `app/config.js` to match what you have.

| column (internal name) | type | what to put in it |
|---|---|---|
| `DeliverableType` | choice | one of the types in the taxonomy |
| `Audiences` | text | semicolon-separated tags: new grad, early career, physician, tech employee, family with children, high earner, founder, business owner, retiree, internal |
| `Topics` | text | semicolon-separated tags: credit cards, rewards, subscriptions, budgeting, student loans, emergency fund, 401(k), charitable giving, estate planning, concentrated stock, equity compensation, home purchase, insurance, retirement income, tax planning, investment performance, large purchase, spend categorisation |
| `Client` | text | anonymised client label, or 'Internal' / 'Reusable template' |
| `DeliveredOn` | text | YYYY-MM; falls back to the file's created date if empty |
| `Pages` | number | slide or page count |
| `Summary` | multi-line text | two to four sentences: what it found or recommended |
| `Outline` | multi-line text | one slide or section title per line |
| `AuthorName` | text | leave empty to use the file's Created By |
| `AuthorRole` | text | e.g. Senior Analyst, Client Analytics |
| `AuthorEmail` | text | leave empty to use the file's Created By |
| `Contributors` | multi-line text | one per line as 'Name <email>' |

Only `DeliverableType`, `Audiences` and `Topics` do real work in search; the rest
improve the answer and the cards. `Title` is the built-in column. Author falls back to
the file's *Created By*, which is usually right.

Two ways to create the columns:

- **In the SharePoint UI.** Library settings → Create column. If you make `Audiences`
  and `Topics` multi-select choice columns with the taxonomy's tags as choices, the app
  reads them as lists; text columns with semicolon-separated tags work the same.
- **With the Graph API.** `python3 tools/sharepoint_columns.py --az SITE_ID LIST_ID`
  prints one `az rest` command per column. Get the ids with
  `az rest --url "https://graph.microsoft.com/v1.0/sites/{hostname}:/sites/{path}"`
  and `.../sites/{site-id}/lists`.

Keep the tags in `library/taxonomy.json` and the library's choices the same; the
taxonomy's aliases are what make "recent graduate" find "new grad".

## 2. The Entra app registration

1. Entra ID → App registrations → New registration. Single tenant.
2. Authentication → Add a platform → **Single-page application**. Redirect URI: the
   app's URL (for local testing, `http://localhost:8765/`; for Azure Static Web Apps,
   `https://<your-app>.azurestaticapps.net/`).
3. API permissions → Microsoft Graph → **Delegated** → `Sites.Read.All` (or
   `Sites.Selected` with the library granted, if your tenant prefers it). Grant admin
   consent, or let each user consent on first sign-in if your tenant allows that.
4. Copy the **Application (client) ID** and the **Directory (tenant) ID**.

## 3. Configure the app

Edit `app/config.js`:

```js
window.LIBRARY_CONFIG = {
  source: 'sharepoint',
  sharepoint: {
    tenantId: '<tenant guid>',
    clientId: '<app registration client id>',
    siteHostname: 'contoso.sharepoint.com',
    sitePath: 'sites/ClientAnalytics',
    libraryName: 'Deliverables',
    columns: { /* only if yours differ from the defaults */ },
  },
  model: { mode: 'proxy', proxyUrl: '/api/ask' },
};
```

Serve the app (`python3 -m http.server -d app 8765`), open it, and sign in when the
popup appears. The footer shows *open the library in SharePoint* once the catalogue has
loaded. If loading fails the page says why and offers the demo catalogue.

## What the app reads

`GET /sites/{hostname}:/{path}` for the site, `GET /sites/{id}/drives` to find the
library by name, then `GET /drives/{id}/root/children?$expand=listItem($expand=fields)`
page by page. Files in sub-folders are not read; keep deliverables at the library root
or extend `loadCatalogue` to recurse.

## Tagging discipline

The search is only as good as the tags. Two habits keep it useful:

- Tag the **audience** the deliverable was made for, not the client's name. "New grad"
  is what people ask for; "Client 0417" is not.
- Write the **summary** as what the deliverable found or recommended, in two to four
  sentences. It is what the model reads, and what the card shows.
