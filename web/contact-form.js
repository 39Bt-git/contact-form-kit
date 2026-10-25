/**
 * Contact Form Kit: website side.
 *
 * Finds every <form class="cfk-form" data-cfk-endpoint="..."> on the page, checks the
 * fields, and posts them to the Google Apps Script web app named in data-cfk-endpoint.
 * No settings live in this file; each site sets its endpoint on the form tag itself.
 *
 * Optional attributes on the form tag to change the messages:
 *   data-cfk-success   shown after a message is sent
 *   data-cfk-fallback  added to errors, e.g. "You can also call us at 555-0100."
 */
(function () {
  "use strict";

  var DEFAULTS = {
    success: "Thanks! Your message is on its way. We'll get back to you soon.",
    sending: "Sending…",
    invalid: "Please fill in the highlighted fields.",
    notConnected: "This form isn't connected yet, so your message wasn't sent.",
    failed: "Something went wrong and your message wasn't sent. Please try again in a moment.",
  };

  function setup(form) {
    var status = form.querySelector(".cfk-status");
    var button = form.querySelector("[type=submit]");
    var fallback = form.getAttribute("data-cfk-fallback") || "";
    var success = form.getAttribute("data-cfk-success") || DEFAULTS.success;

    function show(message, kind, withFallback) {
      if (!status) return;
      status.textContent = message + (withFallback && fallback ? " " + fallback : "");
      status.className = "cfk-status" + (kind ? " cfk-" + kind : "");
    }

    form.noValidate = true; // we show our own messages instead of the browser's bubbles

    form.addEventListener("input", function (e) {
      var field = e.target.closest(".cfk-field");
      if (field) field.classList.remove("cfk-invalid");
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var bad = Array.prototype.filter.call(form.querySelectorAll("[required]"), function (el) {
        return !el.checkValidity();
      });
      form.querySelectorAll(".cfk-field").forEach(function (f) { f.classList.remove("cfk-invalid"); });
      if (bad.length) {
        bad.forEach(function (el) { var f = el.closest(".cfk-field"); if (f) f.classList.add("cfk-invalid"); });
        bad[0].focus();
        show(DEFAULTS.invalid, "error");
        return;
      }

      var endpoint = (form.getAttribute("data-cfk-endpoint") || "").trim(); // read on each send
      if (!endpoint) {
        show(DEFAULTS.notConnected, "error", true);
        return;
      }

      if (button) button.disabled = true;
      show(DEFAULTS.sending);

      // Plain FormData with no custom headers keeps this a "simple" request, which
      // Apps Script web apps accept from any website (they can't answer CORS preflights).
      fetch(endpoint, { method: "POST", body: new FormData(form) })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json().catch(function () { return { ok: true }; });
        })
        .then(function (result) {
          if (!result.ok) throw new Error(result.error || "Rejected");
          form.reset();
          show(success, "ok");
        })
        .catch(function (err) {
          console.error("Contact form:", err);
          show(DEFAULTS.failed, "error", true);
        })
        .then(function () {
          if (button) button.disabled = false;
        });
    });
  }

  function init() {
    document.querySelectorAll("form.cfk-form").forEach(setup);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
