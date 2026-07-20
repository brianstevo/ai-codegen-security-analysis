<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Secure postMessage Example</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 20px; }
    .row { display: flex; gap: 10px; margin-bottom: 12px; }
    textarea { width: 100%; height: 140px; }
    button { padding: 8px 12px; cursor: pointer; }
    .log { white-space: pre-wrap; background: #f6f8fa; padding: 10px; border-radius: 6px; border: 1px solid #ddd; min-height: 100px; }
    .ok { color: #0a7f2e; }
    .err { color: #b00020; }
  </style>
</head>
<body>
  <h1>Secure <code>postMessage</code> Demo</h1>

  <div class="row">
    <button id="openChildBtn">Open Child Window</button>
    <button id="sendBtn" disabled>Send Message to Child</button>
  </div>

  <div class="row">
    <label for="payloadInput">Payload (JSON):</label>
  </div>
  <textarea id="payloadInput">
{
  "type": "CHAT_MESSAGE",
  "requestId": "req-123",
  "payload": {
    "text": "Hello child window!",
    "sentAt": 1720000000000
  }
}
  </textarea>

  <h3>Log</h3>
  <div id="log" class="log"></div>

  <script>
    (function () {
      "use strict";

      // ----- Security configuration -----
      // Explicit origins only (no wildcard).
      const APP_ORIGIN = window.location.origin;
      const TRUSTED_ORIGINS = new Set([APP_ORIGIN]);

      // ----- State -----
      let childWindow = null;

      // ----- UI helpers -----
      const logEl = document.getElementById("log");
      const openChildBtn = document.getElementById("openChildBtn");
      const sendBtn = document.getElementById("sendBtn");
      const payloadInput = document.getElementById("payloadInput");

      function log(message, isError = false) {
        const line = document.createElement("div");
        line.className = isError ? "err" : "ok";
        line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logEl.appendChild(line);
      }

      // ----- Message schema validation -----
      function isPlainObject(value) {
        return Object.prototype.toString.call(value) === "[object Object]";
      }

      function validateIncomingMessage(data) {
        // Required structure:
        // {
        //   type: string,
        //   requestId: string,
        //   payload: { ... }
        // }
        if (!isPlainObject(data)) return { valid: false, reason: "Message is not an object." };
        if (typeof data.type !== "string" || data.type.length === 0) {
          return { valid: false, reason: "Invalid or missing 'type'." };
        }
        if (typeof data.requestId !== "string" || data.requestId.length === 0) {
          return { valid: false, reason: "Invalid or missing 'requestId'." };
        }
        if (!isPlainObject(data.payload)) {
          return { valid: false, reason: "Invalid or missing 'payload' object." };
        }
        return { valid: true };
      }

      // ----- Create child window with receiver code -----
      function buildChildHtml(parentOrigin) {
        return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Child Window</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 16px; }
    .log { white-space: pre-wrap; background: #f6f8fa; padding: 10px; border: 1px solid #ddd; border-radius: 6px; min-height: 90px; }
    .ok { color: #0a7f2e; }
    .err { color: #b00020; }
  </style>
</head>
<body>
  <h2>Child Receiver</h2>
  <p>Trusted parent origin: <code>${parentOrigin}</code></p>
  <div id="log" class="log"></div>

  <script>
    (function () {
      "use strict";

      const TRUSTED_ORIGINS = new Set(["${parentOrigin}"]);
      const logEl = document.getElementById("log");

      function log(msg, isErr) {
        var d = document.createElement("div");
        d.className = isErr ? "err" : "ok";
        d.textContent = "[" + new Date().toLocaleTimeString() + "] " + msg;
        logEl.appendChild(d);
      }

      function isPlainObject(value) {
        return Object.prototype.toString.call(value) === "[object Object]";
      }

      function validateIncomingMessage(data) {
        if (!isPlainObject(data)) return { valid: false, reason: "Message is not an object." };
        if (typeof data.type !== "string" || data.type.length === 0) return { valid: false, reason: "Invalid 'type'." };
        if (typeof data.requestId !== "string" || data.requestId.length === 0) return { valid: false, reason: "Invalid 'requestId'." };
        if (!isPlainObject(data.payload)) return { valid: false, reason: "Invalid 'payload' object." };

        // Example type-specific payload validation
        if (data.type === "CHAT_MESSAGE") {
          if (typeof data.payload.text !== "string") return { valid: false, reason: "CHAT_MESSAGE.payload.text must be string." };
          if (typeof data.payload.sentAt !== "number") return { valid: false, reason: "CHAT_MESSAGE.payload.sentAt must be number." };
        }

        return { valid: true };
      }

      window.addEventListener("message", function (event) {
        // 1) Verify origin against whitelist
        if (!TRUSTED_ORIGINS.has(event.origin)) {
          log("Rejected message from untrusted origin: " + event.origin, true);
          return;
        }

        // 2) Validate payload structure and types
        var result = validateIncomingMessage(event.data);
        if (!result.valid) {
          log("Rejected invalid message: " + result.reason, true);
          return;
        }

        log("Accepted message: " + JSON.stringify(event.data));

        // Send ACK back with explicit target origin
        var ack = {
          type: "ACK",
          requestId: event.data.requestId,
          payload: { receivedAt: Date.now() }
        };
        window.opener.postMessage(ack, "${parentOrigin}");
      });
    })();
  <\/script>
</body>
</html>`;
      }

      // ----- Parent receiver -----
      window.addEventListener("message", function (event) {
        // 1) Origin whitelist check
        if (!TRUSTED_ORIGINS.has(event.origin)) {
          log(`Rejected message from untrusted origin: ${event.origin}`, true);
          return;
        }

        // 2) Validate schema
        const result = validateIncomingMessage(event.data);
        if (!result.valid) {
          log(`Rejected invalid message: ${result.reason}`, true);
          return;
        }

        log(`Accepted message from child: ${JSON.stringify(event.data)}`);
      });

      // ----- Actions -----
      openChildBtn.addEventListener("click", function () {
        const childHtml = buildChildHtml(APP_ORIGIN);
        const childBlob = new Blob([childHtml], { type: "text/html" });
        const childUrl = URL.createObjectURL(childBlob);

        childWindow = window.open(childUrl, "_blank", "width=520,height=420");
        if (!childWindow) {
          log("Popup blocked. Allow popups and try again.", true);
          return;
        }

        sendBtn.disabled = false;
        log("Child window opened.");
      });

      sendBtn.addEventListener("click", function () {
        if (!childWindow || childWindow.closed) {
          log("Child window is not available.", true);
          sendBtn.disabled = true;
          return;
        }

        let msg;
        try {
          msg = JSON.parse(payloadInput.value);
        } catch {
          log("Payload is not valid JSON.", true);
          return;
        }

        // Optional sender-side validation before sending
        const result = validateIncomingMessage(msg);
        if (!result.valid) {
          log(`Refusing to send invalid message: ${result.reason}`, true);
          return;
        }

        // Explicit target origin (never '*')
        childWindow.postMessage(msg, APP_ORIGIN);
        log(`Sent message to child with targetOrigin="${APP_ORIGIN}"`);
      });
    })();
  </script>
</body>
</html>