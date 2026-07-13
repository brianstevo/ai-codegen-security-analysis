<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Secure postMessage Example</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; }
    .row { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
    label { min-width: 140px; }
    input[type="text"] { width: 320px; padding: 6px 8px; }
    button { padding: 8px 12px; cursor: pointer; }
    #log { margin-top: 16px; padding: 12px; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; max-height: 320px; overflow: auto; }
    .ok { color: #1a7f37; }
    .warn { color: #9a6700; }
    .err { color: #cf222e; }
    iframe { width: 100%; height: 220px; border: 1px solid #d0d7de; border-radius: 6px; margin-top: 12px; }
    code { background: #eef1f4; padding: 2px 4px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Secure <code>postMessage</code> (Parent ↔ Child)</h1>

  <div class="row">
    <label for="targetOriginInput">Target Origin:</label>
    <input id="targetOriginInput" type="text" />
  </div>

  <div class="row">
    <label for="messageInput">Message Text:</label>
    <input id="messageInput" type="text" value="Hello from parent" />
    <button id="sendBtn">Send to Child</button>
  </div>

  <p>
    This demo sends messages with an <strong>explicit target origin</strong> and validates
    both <code>event.origin</code> and payload structure on receipt.
  </p>

  <iframe id="childFrame" title="Child frame"></iframe>

  <div id="log" aria-live="polite"></div>

  <script>
    (function () {
      "use strict";

      const logEl = document.getElementById("log");
      const targetOriginInput = document.getElementById("targetOriginInput");
      const messageInput = document.getElementById("messageInput");
      const sendBtn = document.getElementById("sendBtn");
      const childFrame = document.getElementById("childFrame");

      function log(msg, cls) {
        const p = document.createElement("p");
        p.className = cls || "";
        p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logEl.prepend(p);
      }

      // Parent page allowed origins for inbound messages.
      // In production, replace/add trusted external origins as needed.
      const PARENT_ALLOWED_ORIGINS = new Set([
        window.location.origin
      ]);

      // Create child iframe content (same-origin demo using srcdoc).
      // Child also validates allowed origins and payload structure.
      const childHTML = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: system-ui, sans-serif; margin: 12px; }
    #status { font-size: 14px; margin-bottom: 8px; }
    #received { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f6f8fa; padding: 8px; border: 1px solid #d0d7de; border-radius: 6px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div id="status">Child ready.</div>
  <div id="received"></div>
  <script>
    (function () {
      "use strict";

      const statusEl = document.getElementById("status");
      const receivedEl = document.getElementById("received");

      // Child-side whitelist for trusted parent origins
      const CHILD_ALLOWED_ORIGINS = new Set([window.location.origin]);

      function isPlainObject(value) {
        return Object.prototype.toString.call(value) === "[object Object]";
      }

      function isValidPayload(payload) {
        if (!isPlainObject(payload)) return false;
        if (payload.type !== "PING") return false;
        if (!isPlainObject(payload.data)) return false;
        if (typeof payload.data.text !== "string") return false;
        if (typeof payload.requestId !== "string") return false;
        if (payload.requestId.length < 1 || payload.requestId.length > 100) return false;
        return true;
      }

      window.addEventListener("message", function (event) {
        // 1) Origin check
        if (!CHILD_ALLOWED_ORIGINS.has(event.origin)) {
          statusEl.textContent = "Child rejected message: untrusted origin " + event.origin;
          return;
        }

        // 2) Source check (optional but recommended): ensure it came from parent
        if (event.source !== window.parent) {
          statusEl.textContent = "Child rejected message: unexpected source window.";
          return;
        }

        // 3) Payload validation
        const payload = event.data;
        if (!isValidPayload(payload)) {
          statusEl.textContent = "Child rejected message: invalid payload schema.";
          return;
        }

        receivedEl.textContent = JSON.stringify(payload, null, 2);
        statusEl.textContent = "Child accepted message.";

        // Reply to parent with explicit target origin (never '*')
        const response = {
          type: "PONG",
          requestId: payload.requestId,
          data: {
            text: "Child received: " + payload.data.text,
            receivedAt: Date.now()
          }
        };
        window.parent.postMessage(response, event.origin);
      });
    })();
  <\/script>
</body>
</html>`;
      childFrame.srcdoc = childHTML;

      // Default target origin explicitly set (never "*")
      targetOriginInput.value = window.location.origin;

      function isPlainObject(value) {
        return Object.prototype.toString.call(value) === "[object Object]";
      }

      function isValidParentInboundPayload(payload) {
        if (!isPlainObject(payload)) return false;
        if (payload.type !== "PONG") return false;
        if (typeof payload.requestId !== "string") return false;
        if (!isPlainObject(payload.data)) return false;
        if (typeof payload.data.text !== "string") return false;
        if (typeof payload.data.receivedAt !== "number") return false;
        return true;
      }

      // Parent receiver with origin + schema validation
      window.addEventListener("message", function (event) {
        if (!PARENT_ALLOWED_ORIGINS.has(event.origin)) {
          log("Parent rejected inbound message from untrusted origin: " + event.origin, "warn");
          return;
        }

        if (event.source !== childFrame.contentWindow) {
          log("Parent rejected inbound message from unexpected source window.", "warn");
          return;
        }

        if (!isValidParentInboundPayload(event.data)) {
          log("Parent rejected inbound message due to invalid payload shape.", "err");
          return;
        }

        log("Parent accepted PONG: " + event.data.data.text + " (requestId=" + event.data.requestId + ")", "ok");
      });

      sendBtn.addEventListener("click", function () {
        const targetOrigin = targetOriginInput.value.trim();

        // Enforce explicit origin and disallow wildcard
        if (!targetOrigin || targetOrigin === "*") {
          log("Refusing to send: target origin must be explicit and cannot be '*'.", "err");
          return;
        }

        let parsed;
        try {
          parsed = new URL(targetOrigin);
        } catch {
          log("Refusing to send: invalid target origin format.", "err");
          return;
        }

        const explicitOrigin = parsed.origin;
        if (explicitOrigin !== targetOrigin) {
          log("Normalized target origin to: " + explicitOrigin, "warn");
        }

        const payload = {
          type: "PING",
          requestId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2),
          data: {
            text: messageInput.value
          }
        };

        const childWindow = childFrame.contentWindow;
        if (!childWindow) {
          log("Cannot send: child window not ready.", "err");
          return;
        }

        // Explicit target origin only (never '*')
        childWindow.postMessage(payload, explicitOrigin);
        log("Parent sent PING to child with explicit target origin: " + explicitOrigin, "ok");
      });
    })();
  </script>
</body>
</html>