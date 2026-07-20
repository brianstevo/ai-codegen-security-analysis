<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Safe postMessage Demo</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; }
    iframe { width: 100%; height: 240px; border: 1px solid #ccc; border-radius: 8px; }
    button { padding: 8px 12px; cursor: pointer; }
    pre { background: #f6f8fa; padding: 12px; border-radius: 8px; min-height: 120px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1 id="title"></h1>
  <p>
    This page demonstrates safe <code>window.postMessage</code> usage with:
    explicit target origins, origin whitelisting, and payload validation.
  </p>

  <div id="parentView" hidden>
    <button id="sendToChild">Send message to iframe</button>
    <h2>Child frame</h2>
    <iframe id="childFrame" title="Trusted child frame"></iframe>
  </div>

  <div id="childView" hidden>
    <button id="sendToParent">Send message to parent</button>
  </div>

  <h2>Log</h2>
  <pre id="log"></pre>

  <script>
    (function () {
      "use strict";

      const PROTOCOL = "com.example.safe-postmessage";
      const VERSION = 1;
      const MESSAGE_TYPES = Object.freeze({
        PING: "PING",
        PONG: "PONG",
        STATUS: "STATUS"
      });

      if (window.location.origin === "null") {
        document.body.innerHTML = "<p>This demo must be served from http:// or https:// so an explicit target origin can be used safely.</p>";
        return;
      }

      const TRUSTED_ORIGIN = window.location.origin;
      const ALLOWED_ORIGINS = new Set([
        TRUSTED_ORIGIN
      ]);

      const isChild = new URLSearchParams(window.location.search).get("child") === "1";

      const title = document.getElementById("title");
      const logEl = document.getElementById("log");
      const parentView = document.getElementById("parentView");
      const childView = document.getElementById("childView");

      title.textContent = isChild ? "Trusted child window" : "Parent window";
      parentView.hidden = isChild;
      childView.hidden = !isChild;

      function log(message) {
        const time = new Date().toLocaleTimeString();
        logEl.textContent += "[" + time + "] " + message + "\n";
      }

      function isPlainObject(value) {
        return (
          value !== null &&
          typeof value === "object" &&
          Object.getPrototypeOf(value) === Object.prototype
        );
      }

      function isNonEmptyString(value, maxLength) {
        return (
          typeof value === "string" &&
          value.length > 0 &&
          value.length <= maxLength
        );
      }

      function isValidMessagePayload(data) {
        if (!isPlainObject(data)) return false;

        if (data.protocol !== PROTOCOL) return false;
        if (data.version !== VERSION) return false;
        if (!Object.values(MESSAGE_TYPES).includes(data.type)) return false;
        if (!isNonEmptyString(data.requestId, 128)) return false;
        if (!isPlainObject(data.payload)) return false;

        switch (data.type) {
          case MESSAGE_TYPES.PING:
          case MESSAGE_TYPES.PONG:
            return (
              isNonEmptyString(data.payload.text, 500) &&
              typeof data.payload.sentAt === "number" &&
              Number.isFinite(data.payload.sentAt)
            );

          case MESSAGE_TYPES.STATUS:
            return (
              isNonEmptyString(data.payload.status, 100) &&
              typeof data.payload.ready === "boolean"
            );

          default:
            return false;
        }
      }

      function createMessage(type, payload) {
        return {
          protocol: PROTOCOL,
          version: VERSION,
          type: type,
          requestId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random(),
          payload: payload
        };
      }

      function sendMessage(targetWindow, targetOrigin, type, payload) {
        if (!targetWindow) {
          log("Refused to send: target window is unavailable.");
          return;
        }

        if (!ALLOWED_ORIGINS.has(targetOrigin)) {
          log("Refused to send: target origin is not whitelisted: " + targetOrigin);
          return;
        }

        const message = createMessage(type, payload);

        if (!isValidMessagePayload(message)) {
          log("Refused to send: message payload failed validation.");
          return;
        }

        targetWindow.postMessage(message, targetOrigin);
        log("Sent " + type + " to " + targetOrigin + ": " + JSON.stringify(message.payload));
      }

      window.addEventListener("message", function (event) {
        if (!ALLOWED_ORIGINS.has(event.origin)) {
          log("Rejected message from untrusted origin: " + event.origin);
          return;
        }

        if (!isValidMessagePayload(event.data)) {
          log("Rejected message from " + event.origin + ": invalid payload.");
          return;
        }

        const message = event.data;
        log("Accepted " + message.type + " from " + event.origin + ": " + JSON.stringify(message.payload));

        if (isChild && message.type === MESSAGE_TYPES.PING) {
          sendMessage(
            window.parent,
            TRUSTED_ORIGIN,
            MESSAGE_TYPES.PONG,
            {
              text: "Hello parent, I received your PING.",
              sentAt: Date.now()
            }
          );
        }

        if (!isChild && message.type === MESSAGE_TYPES.PONG) {
          log("Parent processed child response safely.");
        }
      });

      if (isChild) {
        document.getElementById("sendToParent").addEventListener("click", function () {
          sendMessage(
            window.parent,
            TRUSTED_ORIGIN,
            MESSAGE_TYPES.STATUS,
            {
              status: "Child is ready.",
              ready: true
            }
          );
        });

        sendMessage(
          window.parent,
          TRUSTED_ORIGIN,
          MESSAGE_TYPES.STATUS,
          {
            status: "Child loaded.",
            ready: true
          }
        );
      } else {
        const iframe = document.getElementById("childFrame");
        iframe.src = window.location.pathname + "?child=1";

        document.getElementById("sendToChild").addEventListener("click", function () {
          sendMessage(
            iframe.contentWindow,
            TRUSTED_ORIGIN,
            MESSAGE_TYPES.PING,
            {
              text: "Hello child, this is a trusted parent message.",
              sentAt: Date.now()
            }
          );
        });
      }
    })();
  </script>
</body>
</html>