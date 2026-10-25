/**
 * Contact Form Kit: Google Apps Script back end.
 *
 * Receives a website's contact form and emails each message from the Google account
 * that owns this script. Paste this whole file into a new project at script.google.com,
 * edit CONFIG for the business, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). See README.md for the full steps.
 */

// ---- Edit for each business ----
const CONFIG = {
  // Shown in the email subject and body so you can tell sites apart.
  SITE_NAME: "My Business Website",

  // Who gets the messages. Comma-separated for several people.
  // Leave empty to send to the Google account that owns (deployed) this script.
  RECIPIENTS: "",

  // Optional: also log every message as a row in a Google Sheet.
  // Paste the sheet's ID (the long part of its URL between /d/ and /edit). Leave empty to skip.
  SHEET_ID: "",

  // Fields the form may send, with their maximum lengths. Anything else is ignored.
  FIELDS: { name: 100, email: 200, phone: 40, company: 150, topic: 100, message: 5000 },

  // Fields that must be filled in.
  REQUIRED: ["name", "email", "message"],

  // At most this many messages per hour, to protect the account's daily email quota
  // (about 100/day for free Gmail, 1,500/day for Google Workspace).
  MAX_PER_HOUR: 20,
};
// ---- End of settings ----

/** Visiting the web app URL in a browser shows this, so you can check the deployment works. */
function doGet() {
  return reply({ ok: true, service: "contact-form-kit", site: CONFIG.SITE_NAME });
}

/** The website's form posts here. */
function doPost(e) {
  try {
    const params = (e && e.parameter) || {};

    // Spam trap: a hidden field people never see. Bots fill it in; pretend success and drop it.
    if (params._gotcha) return reply({ ok: true });

    const data = readFields(params);
    const problem = validate(data);
    if (problem) return reply({ ok: false, error: problem });

    if (!underRateLimit()) return reply({ ok: false, error: "Too many messages right now. Please try again later." });

    sendEmail(data);
    if (CONFIG.SHEET_ID) logToSheet(data);
    return reply({ ok: true });
  } catch (err) {
    console.error(err);
    return reply({ ok: false, error: "The message could not be sent." });
  }
}

/** Keeps only known fields, trims them to their max length, and strips line breaks from one-line fields. */
function readFields(params) {
  const data = {};
  Object.keys(CONFIG.FIELDS).forEach(function (key) {
    let value = String(params[key] || "").trim().slice(0, CONFIG.FIELDS[key]);
    if (key !== "message") value = value.replace(/[\r\n]+/g, " ");
    if (value) data[key] = value;
  });
  return data;
}

/** Returns a message describing the first problem, or "" when the data is fine. */
function validate(data) {
  const missing = CONFIG.REQUIRED.filter(function (key) { return !data[key]; });
  if (missing.length) return "Missing: " + missing.join(", ");
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return "Invalid email address";
  return "";
}

/** Counts messages per clock hour in the script cache. */
function underRateLimit() {
  const cache = CacheService.getScriptCache();
  const key = "count-" + new Date().toISOString().slice(0, 13); // e.g. count-2026-10-25T16
  const count = Number(cache.get(key) || 0);
  if (count >= CONFIG.MAX_PER_HOUR) return false;
  cache.put(key, String(count + 1), 3600);
  return true;
}

function sendEmail(data) {
  const to = CONFIG.RECIPIENTS || Session.getEffectiveUser().getEmail();
  const who = data.name + (data.company ? " (" + data.company + ")" : "");
  const subject = CONFIG.SITE_NAME + ": " + (data.topic || "New message") + " from " + who;

  const labels = { name: "Name", email: "Email", phone: "Phone", company: "Company", topic: "Topic" };
  const lines = Object.keys(labels)
    .filter(function (key) { return data[key]; })
    .map(function (key) { return [labels[key], data[key]]; });

  const body = lines.map(function (l) { return l[0] + ": " + l[1]; }).join("\n") +
    "\n\n" + (data.message || "") + "\n\n- Sent from the contact form on " + CONFIG.SITE_NAME;

  const htmlBody =
    '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">' +
    '<table style="border-collapse:collapse">' +
    lines.map(function (l) {
      return '<tr><td style="padding:4px 14px 4px 0;color:#666">' + l[0] + '</td><td style="padding:4px 0"><b>' + escapeHtml(l[1]) + "</b></td></tr>";
    }).join("") +
    "</table>" +
    '<p style="white-space:pre-wrap;line-height:1.5;margin:16px 0">' + escapeHtml(data.message || "") + "</p>" +
    '<p style="color:#999;font-size:12px">Sent from the contact form on ' + escapeHtml(CONFIG.SITE_NAME) + ". Reply to answer " + escapeHtml(data.name) + " directly.</p>" +
    "</div>";

  MailApp.sendEmail({ to: to, replyTo: data.email, subject: subject, body: body, htmlBody: htmlBody, name: CONFIG.SITE_NAME });
}

function logToSheet(data) {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheets()[0];
  const keys = Object.keys(CONFIG.FIELDS);
  if (sheet.getLastRow() === 0) sheet.appendRow(["Received"].concat(keys));
  sheet.appendRow([new Date()].concat(keys.map(function (k) { return data[k] || ""; })));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
