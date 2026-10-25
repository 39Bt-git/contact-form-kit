# Contact Form Kit

A reusable website contact form that emails each message to a business, using **Google Apps Script** as the back end. Nothing to install, no form company, no monthly cost: the code runs in a Google account the business already has, and messages arrive in its Gmail inbox.

```
Visitor fills out the form  ──►  Apps Script web app (in a Google account)  ──►  Email to the business
                                                                           └──►  (optional) row in a Google Sheet
```

## What's in here

| Path | What it is |
|---|---|
| `apps-script/Code.gs` | The back end. Paste into script.google.com. All per-business settings are in `CONFIG` at the top. |
| `apps-script/appsscript.json` | Limits the script to two permissions: send email, and see the account's email address. |
| `web/contact-form.html` | The form markup to paste into a site. The only required change is `data-cfk-endpoint`. |
| `web/contact-form.css` | Form styles. Change the `--cfk-*` color variables to match a brand. |
| `web/contact-form.js` | Validates the form and sends it. No settings inside, so it never needs editing. |
| `demo/index.html` | Test page: paste a web app URL and send a real test message. |
| `tests/run-tests.js` | Checks `Code.gs` logic without Google (`node tests/run-tests.js`). |

## Setting it up for a new business

### 1. Create the back end (in the business's Google account)

The Google account you create the script in is where messages are sent **from** (and whose daily quota they use). `RECIPIENTS` decides where they go **to**; left empty, the account emails itself. Replies always go to the visitor.

Best practice: use the business's own Google account, or a **forms-only Gmail** (e.g. `acme.forms@gmail.com`) with `RECIPIENTS` set to their real address. That keeps the script, its permissions, and any spam away from a personal inbox.

1. Sign in to **script.google.com** with that account and click **New project**.
2. Name it, for example *Acme Plumbing contact form*.
3. Delete the sample code and paste in all of `apps-script/Code.gs`.
4. Limit its permissions: click **Project Settings** (gear icon) → check **Show "appsscript.json" manifest file in editor**. Back in the editor, open `appsscript.json` and replace its contents with `apps-script/appsscript.json` from this repo. Change `timeZone` if the business isn't in US Central time.
5. Edit `CONFIG` at the top of `Code.gs`:
   - `SITE_NAME`: the business name (shows in every email subject).
   - `RECIPIENTS`: who gets messages, comma-separated. Leave empty to send to the account that owns the script.
   - `SHEET_ID` (optional): to also log messages to a Google Sheet, create a sheet and paste its ID (the part of its URL between `/d/` and `/edit`). **Also add** `"https://www.googleapis.com/auth/spreadsheets"` to `oauthScopes` in `appsscript.json`, or rows won't be written (the email still sends).
   - `FIELDS` / `REQUIRED`: only if you add or remove form fields.
6. Click **Save**.

### 2. Publish it

1. **Deploy → New deployment**.
2. Click the gear next to *Select type* → **Web app**.
3. **Execute as:** Me. **Who has access:** Anyone (so website visitors can reach it; they can't see or edit the code).
4. **Deploy**, then authorize when asked. You'll see *"Google hasn't verified this app"*: that's normal for your own script. Click **Advanced → Go to (project name) (unsafe)**. The permission list should show only **Send email as you** and **See your primary Google Account email address** (plus Google Sheets if you added it). Click **Allow**.
5. Copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`).
6. Open that URL in a browser. You should see `{"ok":true,"service":"contact-form-kit",…}`.

### 3. Add the form to their website

1. Copy `web/contact-form.css` and `web/contact-form.js` into the site, and link them on the contact page:
   ```html
   <link rel="stylesheet" href="contact-form.css">
   <script src="contact-form.js" defer></script>
   ```
2. Paste the form from `web/contact-form.html` where it should appear.
3. Put the web app URL in `data-cfk-endpoint="…"` on the `<form>` tag.
4. Edit the topic options to the business's services (or delete that field).
5. Optional: set `data-cfk-fallback` to a phone number or other way to reach them if a send fails, and `data-cfk-success` for a custom thank-you message.
6. Optional: match their brand by changing the `--cfk-*` variables at the top of the CSS.

### 4. Test it

Open `demo/index.html` (or the live site), paste the web app URL, and send a test message. Check that it arrives, and that **Reply** goes to the address typed in the form.

## Changing the script later

Edits to `Code.gs` don't go live until you redeploy: **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. This keeps the same URL, so the website doesn't change.

## Limits and safety

- **Email quota:** about **100 emails/day** on a free Gmail account, **1,500/day** on Google Workspace. `MAX_PER_HOUR` (default 20) stops a flood from using it all up.
- **Spam:** the hidden `_gotcha` field catches most bots; messages with it filled in are silently dropped.
- **The URL is public** (it's in the site's code), but the script can only email the configured recipients, never anyone else, and only with fields listed in `FIELDS`, trimmed to their max lengths.
- **No passwords in the website:** sending happens inside Google under the account's own permission.
- **Send-only:** the script uses MailApp, which can send but can't read, search, or delete anything in the inbox. `appsscript.json` keeps it to that.
- **Watch links in messages:** anyone can submit the form, and the email arrives from the script's own account. Treat links in form messages like links from a stranger (e.g. a fake "verify your account" note). Using a forms-only Gmail makes this obvious.
- **Protect the Google account:** the script runs as that account, so keep 2-step verification on.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Form says it isn't connected | `data-cfk-endpoint` is empty on the `<form>` tag. |
| "Something went wrong" every time | Open the web app URL directly. If it asks you to sign in, **Who has access** isn't set to *Anyone*: edit the deployment. |
| Changes to `Code.gs` don't take effect | Deploy a **New version** (see above). |
| Works for you, not for visitors | Same as above: access must be *Anyone*, not *Anyone with Google account*. |
| Messages stop arriving mid-day | The daily email quota is used up; it resets within 24 hours. |
| Emails arrive but the Sheet stays empty | Add the spreadsheets scope to `appsscript.json`, deploy a new version, and re-authorize. Errors show under **Executions** in the Apps Script editor. |
| Don't add custom headers to the request | Apps Script can't answer the browser's CORS pre-check; `contact-form.js` sends plain form data on purpose. |
