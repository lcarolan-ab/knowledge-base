# Building the deliverables library on Azure and Microsoft 365

*A plan for taking the idea in this repository — a firm's deliverables compiled into a
searchable knowledge base — and building it on Microsoft's platform instead of as a
static web app. Written 2026-09-21 against the demo in this repo.*

## 1. What the demo is, in Microsoft terms

The repository has five parts. Each has a natural home on Microsoft's platform.

| in this repo | what it is | Microsoft equivalent |
|---|---|---|
| `raw/` | the deliverables, immutable, with provenance metadata | a SharePoint document library with metadata columns, or Azure Blob Storage |
| `wiki/` | compiled client, service and topic pages | a second SharePoint library or site pages, or a Git repo mirrored to Blob |
| ingest | an LLM reads one deliverable and proposes edits across many pages | an Azure Function or Logic App calling a model, with a human approval step |
| lint | deterministic checks: citations resolve, contested pages carry contradictions, nothing stale | a scheduled Azure Function posting to a Teams channel |
| query | a natural-language question answered from the compiled pages with citations | a Copilot Studio agent, a Teams app, or a small web app behind Entra ID |

The distinctive idea is the **compiled layer**. Ordinary "chat with your documents"
answers from the deliverables directly. This design answers from pages that already
hold the cross-document knowledge (which clients have what, what advice recurs, which
projections were superseded), and cites the deliverables behind each figure. Keep that
distinction in mind when choosing a route: several Microsoft products give you document
search out of the box, and none gives you the compiled layer without some build.

## 2. Three routes

### Route A: Microsoft 365 native (SharePoint + Copilot Studio)

Put the deliverables in a SharePoint document library with metadata columns for client,
deliverable type, period, status and supersedes. Build a Copilot Studio agent whose
knowledge source is that library. Users ask questions in Teams; the agent answers with
links to the documents. Permissions are inherited from SharePoint, so a user only ever
gets answers from deliverables they could already open.

- **Strengths.** Fastest path to a working natural-language search over the
  deliverables; little or no code; security and audit come from Microsoft 365; no new
  infrastructure to run.
- **Limits.** This is retrieval, not compilation. The agent has no page that says "the
  Kesslers' November projection is superseded" unless someone writes it. Citations point
  at documents, not at compiled claims. Compilation and lint logic are hard to express
  in Copilot Studio. Requires Copilot Studio licensing, and Microsoft 365 Copilot
  licences if you want the same agent surfaced inside Copilot.
- **Best for.** A demo in weeks, or a firm that mostly needs "find the document" and
  will accept cross-document questions being answered less reliably.

### Route B: Azure custom build (the faithful port of this repo)

Deliverables land in Blob Storage or SharePoint. An event triggers a Function that
extracts text, records provenance, and calls a model to propose page edits, exactly as
the ingest operation here does. A human approves the proposal. Approved pages are
committed to a Git repo and indexed in Azure AI Search along with the raw text, each
record tagged with its layer, client, service, status and sources. A scheduled Function
runs the same lint invariants nightly. A query surface (Teams app, Copilot Studio agent
with a custom connector, or a small web app) answers from the compiled layer first and
cites deliverable ids.

- **Strengths.** Preserves the whole idea: compiled pages, contradictions and
  supersession as first-class content, lint as a gate, citations to deliverables. Every
  component is standard Azure. The model can be Azure OpenAI or Claude on Microsoft
  Foundry, both reachable with Entra ID inside your tenant.
- **Limits.** It is a build: a few thousand lines of pipeline code and a UI, plus
  operations. Needs an engineer for the initial delivery and someone to own it after.
- **Best for.** A firm that wants the cross-document answers and is prepared to own a
  small system.

### Route C: hybrid (recommended)

SharePoint stays the front door for deliverables and permissions. Azure does the
compilation and holds the index. Teams is the query surface. Start with Route A to get
search in front of people quickly, then add Route B's compile-and-lint pipeline behind
it, so the agent starts answering from compiled pages. The SharePoint library never
moves, so nothing users learned in phase one is thrown away.

## 3. Recommended architecture (Route C in detail)

### Components

| component | role |
|---|---|
| **SharePoint document library** | the `raw/` layer. Columns: client, deliverable type, period, delivered on, status (current / superseded), supersedes (link), sensitivity label. Retention label set so deliverables cannot be edited or deleted after filing. |
| **Azure Blob Storage** (optional mirror) | a copy of each deliverable's extracted text and metadata, written by the pipeline, so Azure components never read SharePoint directly on the hot path. |
| **Azure AI Document Intelligence** | extracts text and tables from PDF and Word deliverables. Tables matter here: the figures in a card analysis live in tables. |
| **Azure Functions (Durable)** | the compiler. One orchestration per new deliverable: extract, gather the pages it touches, call the model, produce a proposal, wait for approval, commit, index. A second, scheduled Function is lint. |
| **Model: Azure OpenAI or Claude on Microsoft Foundry** | the compile and query model. Both are called with Entra ID credentials and stay inside your Azure subscription and its data-handling terms. The prompts in `app/lib/provider.js` transfer with little change. |
| **Azure AI Search** | one index, two layers. Compiled pages are chunked by section with fields: slug, type, client, service, status, updated, sources. Raw deliverables are chunked with client, deliverable, period, source_id. Hybrid (keyword plus vector) search with a filter on layer. Security trimming: each document carries the group ids allowed to see it, and every query filters on the caller's groups. |
| **Git repository (Azure Repos or GitHub)** | the `wiki/` layer of record. Every approved compile is a commit, so the audit trail and the diff view in this repo carry over unchanged. `tools/wiki.py lint` runs in the pipeline exactly as it does here. |
| **Approval step: Teams Adaptive Card via Power Automate** | the human gate on writes. The proposal (page diffs, contradictions found, lint result) is posted to the analyst who owns the client; approve commits, reject discards with a note. |
| **Query surface** | a Copilot Studio agent calling an Azure Function (custom connector) that runs the compiled-layer query, or a Teams message extension, or a small web app on Azure Container Apps behind built-in Entra ID authentication. |
| **Azure Key Vault + managed identities** | every secret. No key ever sits in code, config files or a browser. |
| **Azure Monitor / Log Analytics** | every query, every compile, every approval, with the caller's identity. |

### Data flow

1. An analyst files a deliverable in the SharePoint library and fills in the columns.
2. A SharePoint event (via Power Automate or Graph change notifications) starts the
   compile orchestration.
3. The Function extracts text with Document Intelligence, writes the provenance record,
   and pulls the pages the deliverable touches: the client page, the service page for
   that deliverable type, and any topic pages whose terms match.
4. The model returns a proposal in the same JSON contract this repo uses: full new page
   bodies, a contradictions list, a log line. The Function runs lint on the proposal.
5. The proposal goes to the owning analyst as an Adaptive Card. Nothing is written
   until they approve. A proposal that fails lint cannot be approved.
6. On approval the pages are committed, the log is appended, and both layers are
   re-indexed in AI Search.
7. The nightly lint Function runs the invariants over the whole repo and posts the
   result to a Teams channel: stale pages, uningested deliverables, orphans.
8. A user asks the agent a question. The query Function searches the compiled layer
   with the user's security filter, builds the prompt from the top pages, and asks the
   model to answer with citations. If the compiled layer cannot answer, it says so and
   offers the top raw matches, flagged as uncompiled. That miss is logged as a compiler
   bug for the analyst to fix, which is the feedback loop that keeps the library current.

## 4. Security and compliance

This is client financial data. The controls below are the ones that matter most.

- **Identity everywhere.** Entra ID for users, managed identities for services. No
  shared keys, no API keys in browsers.
- **Permission trimming at the index.** AI Search results are filtered by the caller's
  group memberships on every query, mirroring SharePoint permissions. A user cannot get
  an answer synthesised from a deliverable they could not open.
- **Sensitivity labels and DLP.** Apply Purview sensitivity labels to the library; use
  DLP policies to stop deliverables leaving the tenant through the agent.
- **Private networking.** Private endpoints for Storage, AI Search, Key Vault and the
  model endpoint; Functions inside a VNet; no public ingress except the query surface,
  which sits behind Entra ID.
- **Data handling by the model.** Both Azure OpenAI and Claude on Microsoft Foundry
  process data inside your Azure subscription under Microsoft's enterprise terms.
  Confirm the regional deployment and the data-retention configuration for your tenant
  before the pilot; do not rely on defaults.
- **Immutability of the raw layer.** SharePoint retention labels, or Blob immutability
  policies, so a deliverable cannot be altered after filing. Supersession is a new file,
  never an edit, which is rule 5 of the schema.
- **Audit.** Log every query with the caller and the pages used, every compile with the
  approver, and every lint result. Keep the Git history: it is the audit trail for the
  compiled layer.
- **Encryption.** Customer-managed keys for Storage and AI Search if your policy
  requires them.

## 5. Phased plan

| phase | duration | outcome |
|---|---|---|
| **0. Decide and prepare** | 1–2 weeks | Choose the route. Inventory deliverable types. Agree the metadata schema (client, type, period, status, supersedes). Pick 30–50 deliverables for the pilot, redacted or synthetic. Write 30 test questions with known answers, including "which clients", "what did we recommend", and at least two where the answer spans deliverables. |
| **1. Search over deliverables** | 2–4 weeks | SharePoint library with columns; Copilot Studio agent grounded on it; Teams rollout to a pilot group. Score the agent on the test questions. Expect the cross-document questions to be the ones it gets wrong; that is the case for phase 2. |
| **2. The compiled layer** | 4–8 weeks | Compile pipeline in Azure with the approval step; lint on a schedule; AI Search index with both layers; the agent switched to answer from compiled pages with deliverable citations. Re-score the test questions. |
| **3. Operate** | ongoing | Add deliverable types; a monthly review of lint output and query misses; expand the test set as new question types appear. The library is only as current as the ingest discipline. |

## 6. What it costs, in shape rather than numbers

- **Licences** dominate Route A: Copilot Studio, and Microsoft 365 Copilot if used.
- **Model tokens** dominate Route B and C, and compilation costs more than querying,
  because each ingest reads several full pages and rewrites them. Ten deliverables a
  week is a small bill; a backfill of a thousand is a project.
- **AI Search** is a fixed monthly tier; the basic tier is enough for a pilot.
- **Functions, Storage, Key Vault, Monitor** are small.

Ask for a costed estimate once the deliverable volume and the route are known.

## 7. Decisions needed now

1. Route A first, or straight to C? The recommendation is C, entered through A.
2. Which model: Azure OpenAI, or Claude on Microsoft Foundry? Both work; pick on your
   existing agreements and on a bake-off over the 30 test questions.
3. Who owns approvals? The compile step needs a named analyst per client, or the
   proposals queue and the library goes stale.
4. Is SharePoint the system of record for deliverables today? If not, that is the
   first thing to fix, independent of anything here.

## 8. How this repository maps onto the build

| file here | becomes |
|---|---|
| `CLAUDE.md` | the compile prompt and the review checklist for approvers |
| `tools/wiki.py` | the lint Function, unchanged |
| `app/lib/provider.js` (prompts, JSON contract) | the compile and query Functions |
| `app/lib/wiki.js` (client-side lint) | the proposal check before approval |
| `wiki/` page types: client, service, topic, question | the index schema and the agent's answer templates |
| the demo ingest (`app/lib/demo.js`) | the first acceptance test: a deliverable that contradicts a compiled assumption must produce a contested page, not a silent update |

## 9. If the web app stays

If you keep the app in this repo as the query surface, host it on Azure Container Apps
with built-in Entra ID authentication in front of everything, and move the proxy in
`proxy/worker.js` behind that same authentication with the API key in Key Vault. Azure
Static Web Apps is simpler but its API proxy has a request timeout that a long compile
call will exceed. Either way, hide the app's "Direct" mode in the deployed build: a
shared deployment should never ask users to paste API keys into a browser.
