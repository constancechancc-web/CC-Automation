# Property Leads WhatsApp Dashboard

A Node.js + TypeScript + Express server that connects the WhatsApp Business
Cloud API to a Google Sheet. There is no database and no AI — the Sheet
itself is the only data store, and every incoming WhatsApp message becomes
one row (matched by phone number, so repeat messages update the existing
row instead of creating a duplicate).

## 1. Create the Google Service Account and share the Sheet

1. Go to the [Google Cloud Console](https://console.cloud.google.com/),
   create (or pick) a project, and enable the **Google Sheets API**.
2. Go to **APIs & Services → Credentials → Create Credentials → Service
   Account**. Give it any name (e.g. `property-leads-bot`).
3. Open the new service account → **Keys → Add Key → Create new key →
   JSON**. This downloads a `.json` key file — keep it out of git (the
   `.gitignore` in this repo already blocks common patterns for these
   files, but double-check before committing).
4. Create a Google Sheet with a tab named exactly `Sheet1` and a header
   row across columns A–I:
   `Date | Contact No | Name | Requirement | Budget | Remark | Source | Status | Last Follow Up Date`
5. Copy the service account's email address (looks like
   `xxx@your-project.iam.gserviceaccount.com`) and **Share** the Sheet
   with it, giving it **Editor** access.
6. Copy the Sheet's ID out of its URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART_IS_THE_ID`**`/edit`

## 2. Fill in `.env` for local development

Copy `.env.example` to `.env` (already scaffolded, gitignored) and fill in:

- `META_VERIFY_TOKEN` — any string you make up yourself; it just needs to
  match what you enter later in the Meta dashboard.
- `META_ACCESS_TOKEN` / `META_PHONE_NUMBER_ID` — from your Meta App
  dashboard under **WhatsApp → API Setup**.
- `GOOGLE_SHEET_ID` — from step 1.6 above.
- `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` — local filesystem path to the JSON
  key file downloaded in step 1.3. Leave `GOOGLE_SERVICE_ACCOUNT_JSON`
  commented out; only one of the two is needed at a time.

> I don't have these values — you'll need to get them from your own Meta
> App and Google Cloud project and paste them into `.env` yourself.

## 3. Run locally

```bash
npm install
npm run dev
```

Smoke-test the verification endpoint (replace `YOUR_TOKEN` with your
`META_VERIFY_TOKEN`):

```bash
curl "http://localhost:3000/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=12345"
```

You should get back `12345`. Then open `http://localhost:3000` in a
browser — you should see the dashboard with the empty state ("No leads
yet...") since the Sheet has no data rows yet.

## 4. Deploy to Railway

1. Push this repo to GitHub.
2. In [Railway](https://railway.app/), create a new project → **Deploy
   from GitHub repo** → select this repo.
3. In the Railway project's **Variables** tab, set the same env vars as
   your local `.env`, with one difference: instead of
   `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`, set **`GOOGLE_SERVICE_ACCOUNT_JSON`**
   — paste the *entire contents* of the downloaded key file as the value
   (Railway has no persistent file storage, so the key travels as an env
   var instead of a file path).
4. Under **Settings → Networking**, generate a public domain.

## 5. Point Meta's webhook at the Railway domain

In your Meta App dashboard, under **WhatsApp → Configuration**:

- **Callback URL**: `https://your-app.up.railway.app/webhook/whatsapp`
- **Verify Token**: the same `META_VERIFY_TOKEN` you set in step 2/4.
- Click **Verify and Save**.
- Subscribe to the **`messages`** webhook field.

Send a real WhatsApp message to your business number and check that a
row appears in the Google Sheet.

## 6. View the live dashboard

Visit your Railway domain directly (`https://your-app.up.railway.app/`)
to see the dashboard, populated with real leads as messages come in.

---

## Known gotchas

- **Meta phone number verification can take longer than the "3 minutes"
  Meta advertises**, especially if you're migrating a number that was
  already in use elsewhere. Don't panic and don't keep retrying —
  repeated retries can trigger a separate rate limit. Just wait and try
  again later.
- **A WhatsApp Cloud API number can never join or read a WhatsApp
  Group.** This is a hard platform limitation, not something to debug
  around.
- **If your Meta app is unpublished**, real messages sent from a personal
  phone may not reach the webhook at all — only payloads triggered from
  the Meta dashboard's test tool will. Publishing the app (which requires
  a privacy policy URL) fixes this.

## Project structure

```
src/
  index.ts                  # Express entry point
  services/sheets.ts         # Shared Google Sheets client (dual-path auth)
  routes/
    whatsapp-webhook.ts      # Meta webhook verification + message ingestion
    api.ts                   # /api/leads CRUD backing the dashboard
public/
  index.html                 # Static dashboard (no build step)
```
