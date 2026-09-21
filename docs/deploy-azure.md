# Hosting on Azure

The app is static files plus one small function, so **Azure Static Web Apps** hosts
the whole thing: the page, the sign-in gate, and the `/api/ask` function that holds the
model key. One resource, one deployment token, one GitHub Actions workflow
(`.github/workflows/azure-static-web-apps.yml`).

```
browser ──(Entra sign-in)──▶ Static Web App ──▶ app/ (static files)
   │                              │
   │  MSAL, delegated token       └──▶ api/ask (Functions) ──▶ Claude API
   ▼                                        key from app settings / Key Vault
Microsoft Graph ──▶ SharePoint library
```

Two identities are involved, and it is worth being clear about them:

- **Static Web Apps sign-in** gates the *site*. Nobody reaches the page or the
  function without it.
- **MSAL sign-in inside the page** gets a *Graph token* for SharePoint, in the user's
  own name. Static Web Apps cannot mint Graph tokens, so the page does this itself.

## 1. Create the Static Web App

Portal → Create → Static Web App. Plan: **Standard** if you want to restrict sign-in to
your own tenant (recommended); Free otherwise. Source: GitHub, this repository, branch
`main`. Build presets: Custom, app location `app`, api location `api`, output location
empty. The portal offers to commit a workflow; decline and use the one in the repo.
Copy the **deployment token** from the Overview blade into a repository secret named
`AZURE_STATIC_WEB_APPS_API_TOKEN`.

The workflow validates the library, builds the catalogue, runs the tests, and deploys.
A pull request gets a preview URL; closing it removes the preview.

## 2. Restrict sign-in to your tenant

`app/staticwebapp.config.json` requires the `authenticated` role for every route and
sends anonymous visitors to `/.auth/login/aad`. On the Free plan that built-in provider
accepts **any** Microsoft account, personal ones included. To limit it to your tenant:

1. Standard plan.
2. Create an app registration for the site (Web platform, redirect URI
   `https://<your-app>.azurestaticapps.net/.auth/login/aad/callback`), with a client
   secret.
3. Add to the config file:
   ```json
   "auth": {
     "identityProviders": {
       "azureActiveDirectory": {
         "registration": {
           "openIdIssuer": "https://login.microsoftonline.com/<tenant-id>/v2.0",
           "clientIdSettingName": "AAD_CLIENT_ID",
           "clientSecretSettingName": "AAD_CLIENT_SECRET"
         }
       }
     }
   }
   ```
4. Put `AAD_CLIENT_ID` and `AAD_CLIENT_SECRET` in the Static Web App's application
   settings (Configuration blade).

## 3. The model key

Application settings → add `ANTHROPIC_API_KEY`. Settings are encrypted at rest and only
the function reads them. For Key Vault: enable the Static Web App's system-assigned
managed identity, grant it *Get* on the secret, and set the value to
`@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/anthropic-api-key/)`.

The function (`api/src/functions/ask.js`):

- refuses any request without the `x-ms-client-principal` header that Static Web Apps
  injects after sign-in, so it cannot be called from outside the site;
- fixes the model server-side and caps tokens, so a caller cannot choose a costlier one;
- rate-limits per user (40 questions per 10 minutes per instance);
- logs who asked and the token counts to Application Insights.

Set a spend limit on the Anthropic workspace whose key you use. That is the ceiling if
anything else fails.

## 4. Connect SharePoint

Follow `docs/sharepoint-setup.md`. The app registration for Graph is a *separate* one
from the site's sign-in registration (it is a single-page application, delegated
permissions, no secret). Its redirect URI is the Static Web App's URL. Then edit
`app/config.js` and merge; the workflow deploys it.

The content security policy in `staticwebapp.config.json` already allows
`graph.microsoft.com`, `login.microsoftonline.com` and the CDN that serves MSAL. If you
self-host MSAL, tighten `script-src` to `'self'`.

## 5. Custom domain and monitoring

Custom domains blade → add `library.contoso.com` with the CNAME it shows; the certificate
is managed. Enable Application Insights on the Static Web App for function logs; the
`ask` function logs one line per question with the user and token counts, which is also
the usage report.

## Alternatives

- **Azure App Service or Container Apps** if you would rather run one container with
  built-in authentication (Easy Auth) in front of both the page and the API. More to
  operate; useful only if you later add long-running server work.
- **Copilot Studio agent grounded on the SharePoint library**, with no custom app at
  all. Cheapest to stand up if your tenant has the licences; you give up the tag-aware
  search, the people cards and the tuned answer format. Worth trying alongside this
  app for a week and comparing on the same twenty questions.

## Costs, in shape

Static Web Apps Standard is a small fixed monthly fee; Functions usage at this volume
rounds to zero; the model bill is per question and small because answers are short and
the catalogue prompt is a few thousand tokens. SharePoint and Graph cost nothing extra.
