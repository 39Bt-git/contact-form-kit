// Runs apps-script/Code.gs in Node with fake Google services, to check its logic without deploying.
// Usage: node tests/run-tests.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const code = fs.readFileSync(path.join(__dirname, "..", "apps-script", "Code.gs"), "utf8");

function load() {
  const sent = [];
  const rows = [];
  const cache = new Map();
  const ctx = {
    console: { error() {} },
    MailApp: { sendEmail: (msg) => sent.push(msg) },
    Session: { getEffectiveUser: () => ({ getEmail: () => "owner@example.com" }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
    SpreadsheetApp: {
      openById: () => ({ getSheets: () => [{ getLastRow: () => rows.length, appendRow: (r) => rows.push(r) }] }),
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(code + "\n;globalThis.__CONFIG = CONFIG;", ctx);
  const post = (params) => JSON.parse(ctx.doPost({ parameter: params }).text);
  return { ctx, sent, rows, CONFIG: ctx.__CONFIG, post };
}

const good = { name: "Arturo Lopez", email: "arturo@example.com", company: "Red Viper", topic: "IT Setup", message: "Need help with <b>our</b> office." };
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("ok  " + name);
}

test("GET shows the service is up", () => {
  const { ctx } = load();
  assert.deepStrictEqual(JSON.parse(ctx.doGet().text).ok, true);
});

test("valid message is emailed to the script owner", () => {
  const { sent, post } = load();
  assert.deepStrictEqual(post(good), { ok: true });
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].to, "owner@example.com");
  assert.strictEqual(sent[0].replyTo, "arturo@example.com");
  assert.ok(sent[0].subject.includes("IT Setup from Arturo Lopez (Red Viper)"));
  assert.ok(sent[0].htmlBody.includes("&lt;b&gt;our&lt;/b&gt;"), "message HTML is escaped");
  assert.ok(!sent[0].htmlBody.includes("<b>our</b>"));
});

test("RECIPIENTS overrides the owner", () => {
  const { sent, post, CONFIG } = load();
  CONFIG.RECIPIENTS = "a@biz.com, b@biz.com";
  post(good);
  assert.strictEqual(sent[0].to, "a@biz.com, b@biz.com");
});

test("spam trap drops the message but reports success", () => {
  const { sent, post } = load();
  assert.deepStrictEqual(post({ ...good, _gotcha: "http://spam" }), { ok: true });
  assert.strictEqual(sent.length, 0);
});

test("missing required fields are rejected", () => {
  const { sent, post } = load();
  const r = post({ email: "x@example.com" });
  assert.strictEqual(r.ok, false);
  assert.ok(r.error.includes("name") && r.error.includes("message"));
  assert.strictEqual(sent.length, 0);
});

test("invalid email is rejected", () => {
  const { sent, post } = load();
  assert.strictEqual(post({ ...good, email: "not-an-email" }).ok, false);
  assert.strictEqual(sent.length, 0);
});

test("line breaks are stripped from one-line fields (no header tricks)", () => {
  const { sent, post } = load();
  post({ ...good, name: "Eve\r\nBcc: victim@example.com" });
  assert.ok(!/[\r\n]/.test(sent[0].subject));
});

test("unknown fields are ignored and long values are trimmed", () => {
  const { sent, post } = load();
  post({ ...good, admin: "yes", message: "x".repeat(9000) });
  assert.ok(!sent[0].body.includes("admin"));
  assert.ok(sent[0].body.split("\n\n")[1].length === 5000);
});

test("hourly limit stops a flood", () => {
  const { sent, post, CONFIG } = load();
  CONFIG.MAX_PER_HOUR = 3;
  const results = [1, 2, 3, 4, 5].map(() => post(good).ok);
  assert.deepStrictEqual(results, [true, true, true, false, false]);
  assert.strictEqual(sent.length, 3);
});

test("optional Google Sheet log gets a header row then data", () => {
  const { rows, post, CONFIG } = load();
  CONFIG.SHEET_ID = "sheet-123";
  post(good);
  post(good);
  assert.strictEqual(rows.length, 3);
  // rows were built inside the sandbox, so compare contents rather than array identity
  assert.deepStrictEqual(JSON.parse(JSON.stringify(rows[0])), ["Received", "name", "email", "phone", "company", "topic", "message"]);
  assert.strictEqual(rows[1][1], "Arturo Lopez");
});

test("a mail failure returns ok:false instead of crashing", () => {
  const { ctx, post } = load();
  ctx.MailApp.sendEmail = () => { throw new Error("quota"); };
  assert.strictEqual(post(good).ok, false);
});

console.log(`\n${passed} tests passed`);
