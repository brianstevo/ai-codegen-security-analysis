<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Safe postMessage Demo</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; line-height: 1.4; }
    button { margin: 0 8px 8px 0; padding: 8px 12px; }
    iframe { display: block; width: 100%; height: 260px; border: 1px solid #bbb; border-radius: 8px; margin-top: 16px; }
    pre { background: #111; color: #eee; padding: 12px; border-radius: 8px; overflow: auto; min-height: 120px; }
    .warning { color: #9a5b00; background: #fff4d6; border: 1px solid #f3d27a; padding: 10px; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>Safe postMessage Communication</h1>

  <p>
    This page communicates with the embedded iframe using <code>window.postMessage</code>.
    Every send uses an explicit target origin, and every receiver validates both
    <code>event.origin</code> and the received payload shape.
  </p>

  <p id="originWarning" class="warning" hidden></p>

  <button id="sendPing" type="button">Send valid PING to iframe</button>
  <button id="sendColor" type="button">Send valid SET_COLOR to iframe</button>
  <button id="sendInvalid" type="button">Send invalid message to iframe</button>

  <iframe id="childFrame" title="postMessage child frame"></iframe>

  <h2>Parent log</h2>
  <pre id="parentLog"></pre>

  <script>
    (function () {
      "use strict";

      const PROTOCOL = "safe-postmessage-demo/v1";
      const CURRENT_ORIGIN = window.location.origin;
      const CAN_USE_EXPLICIT_ORIGIN = /^https?:\/\/[^/]+$/i.test(CURRENT_ORIGIN);

      const parentLog = document.getElementById("parentLog");
      const originWarning = document.getElementById("originWarning");
      const childFrame = document.getElementById("childFrame");
      const sendPingButton = document.getElementById("sendPing");
      const sendColorButton = document.getElementById("sendColor");
      const sendInvalidButton = document.getElementById("sendInvalid");

      if (!CAN_USE_EXPLICIT_ORIGIN) {
        originWarning.hidden = false;
        originWarning.textContent =
          "This demo must be served from an http:// or https:// origin. Current origin is " +
          JSON.stringify(CURRENT_ORIGIN) +
          ", so messages will not be sent.";
      }

      const TRUSTED_CHILD_ORIGINS = new Set([CURRENT_ORIGIN]);
      const TARGET_CHILD_ORIGIN = CURRENT_ORIGIN;

      const MessageType = Object.freeze({
        PING: "PING",
        PONG: "PONG",
        SET_COLOR: "SET_COLOR",
        ERROR: "ERROR"
      });

      function log(message, value) {
        const time = new Date().toLocaleTimeString();
        const suffix = value === undefined ? "" : "\n" + JSON.stringify(value, null, 2);
        parentLog.textContent += "[" + time + "] " + message + suffix + "\n\n";
        parentLog.scrollTop = parentLog.scrollHeight;
      }

      function isPlainObject(value) {
        return (
          value !== null &&
          typeof value === "object" &&
          Object.prototype.toString.call(value) === "[object Object]"
        );
      }

      function createMessage(type, payload) {
        return {
          protocol: PROTOCOL,
          type: type,
          id: createId(),
          timestamp: Date.now(),
          payload: payload
        };
      }

      function createId() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
          return window.crypto.randomUUID();
        }

        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes, function (byte) {
          return byte.toString(16).padStart(2, "0");
        }).join("");
      }

      function validateBaseMessage(data, allowedTypes) {
        if (!isPlainObject(data)) {
          return { ok: false, reason: "Message must be a plain object." };
        }

        if (data.protocol !== PROTOCOL) {
          return { ok: false, reason: "Unexpected protocol." };
        }

        if (typeof data.type !== "string" || !allowedTypes.has(data.type)) {
          return { ok: false, reason: "Unexpected or missing message type." };
        }

        if (typeof data.id !== "string" || data.id.length < 1 || data.id.length > 100) {
          return { ok: false, reason: "Invalid message id." };
        }

        if (
          typeof data.timestamp !== "number" ||
          !Number.isFinite(data.timestamp) ||
          Math.abs(Date.now() - data.timestamp) > 5 * 60 * 1000
        ) {
          return { ok: false, reason: "Invalid or stale timestamp." };
        }

        if (!isPlainObject(data.payload)) {
          return { ok: false, reason: "Payload must be a plain object." };
        }

        return { ok: true, message: data };
      }

      function validateParentInboundMessage(data) {
        const base = validateBaseMessage(
          data,
          new Set([MessageType.PONG, MessageType.ERROR])
        );

        if (!base.ok) return base;

        const message = base.message;
        const payload = message.payload;

        if (message.type === MessageType.PONG) {
          if (
            typeof payload.text !== "string" ||
            payload.text.length > 200 ||
            typeof payload.receivedMessageId !== "string" ||
            payload.receivedMessageId.length > 100
          ) {
            return { ok: false, reason: "Invalid PONG payload." };
          }
        }

        if (message.type === MessageType.ERROR) {
          if (
            typeof payload.code !== "string" ||
            payload.code.length > 60 ||
            typeof payload.message !== "string" ||
            payload.message.length > 300
          ) {
            return { ok: false, reason: "Invalid ERROR payload." };
          }
        }

        return { ok: true, message: message };
      }

      function postToChild(type, payload) {
        if (!CAN_USE_EXPLICIT_ORIGIN) {
          log("Blocked send because this page does not have an explicit http(s) origin.");
          return;
        }

        if (!childFrame.contentWindow) {
          log("Blocked send because iframe window is unavailable.");
          return;
        }

        const message = createMessage(type, payload);
        childFrame.contentWindow.postMessage(message, TARGET_CHILD_ORIGIN);
        log("Parent sent " + type + " to " + TARGET_CHILD_ORIGIN, message);
      }

      window.addEventListener("message", function (event) {
        if (!TRUSTED_CHILD_ORIGINS.has(event.origin)) {
          log("Parent rejected message from untrusted origin: " + event.origin);
          return;
        }

        if (event.source !== childFrame.contentWindow) {
          log("Parent rejected message from unknown window.");
          return;
        }

        const validation = validateParentInboundMessage(event.data);

        if (!validation.ok) {
          log("Parent rejected malformed message: " + validation.reason, event.data);
          return;
        }

        const message = validation.message;

        if (message.type === MessageType.PONG) {
          log("Parent processed PONG.", message);
        } else if (message.type === MessageType.ERROR) {
          log("Parent processed ERROR.", message);
        }
      });

      sendPingButton.addEventListener("click", function () {
        postToChild(MessageType.PING, {
          text: "Hello iframe. Please reply with PONG."
        });
      });

      sendColorButton.addEventListener("click", function () {
        const colors = ["#f8d7da", "#d1e7dd", "#cfe2ff", "#fff3cd", "#e2e3e5"];
        const color = colors[Math.floor(Math.random() * colors.length)];

        postToChild(MessageType.SET_COLOR, {
          color: color
        });
      });

      sendInvalidButton.addEventListener("click", function () {
        if (!CAN_USE_EXPLICIT_ORIGIN || !childFrame.contentWindow) return;

        const invalidMessage = {
          protocol: PROTOCOL,
          type: MessageType.PING,
          id: createId(),
          timestamp: Date.now(),
          payload: {
            text: 12345
          }
        };

        childFrame.contentWindow.postMessage(invalidMessage, TARGET_CHILD_ORIGIN);
        log("Parent sent intentionally invalid message to " + TARGET_CHILD_ORIGIN, invalidMessage);
      });

      childFrame.srcdoc = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui, sans-serif; margin: 16px; transition: background-color 160ms ease; }
    pre { background: #222; color: #eee; padding: 10px; border-radius: 8px; overflow: auto; min-height: 120px; }
  </style>
</head>
<body>
  <h2>Child iframe</h2>
  <p>The iframe only accepts messages from its trusted parent origin.</p>
  <pre id="childLog"></pre>

  <script>
    (function () {
      "use strict";

      const PROTOCOL = ${JSON.stringify(PROTOCOL)};
      const TRUSTED_PARENT_ORIGIN = ${JSON.stringify(CURRENT_ORIGIN)};
      const TRUSTED_PARENT_ORIGINS = new Set([TRUSTED_PARENT_ORIGIN]);

      const MessageType = Object.freeze({
        PING: "PING",
        PONG: "PONG",
        SET_COLOR: "SET_COLOR",
        ERROR: "ERROR"
      });

      const childLog = document.getElementById("childLog");

      function log(message, value) {
        const time = new Date().toLocaleTimeString();
        const suffix = value === undefined ? "" : "\\n" + JSON.stringify(value, null, 2);
        childLog.textContent += "[" + time + "] " + message + suffix + "\\n\\n";
        childLog.scrollTop = childLog.scrollHeight;
      }

      function isPlainObject(value) {
        return (
          value !== null &&
          typeof value === "object" &&
          Object.prototype.toString.call(value) === "[object Object]"
        );
      }

      function createId() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
          return window.crypto.randomUUID();
        }

        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes, function (byte) {
          return byte.toString(16).padStart(2, "0");
        }).join("");
      }

      function createMessage(type, payload) {
        return {
          protocol: PROTOCOL,
          type: type,
          id: createId(),
          timestamp: Date.now(),
          payload: payload
        };
      }

      function validateBaseMessage(data, allowedTypes) {
        if (!isPlainObject(data)) {
          return { ok: false, reason: "Message must be a plain object." };
        }

        if (data.protocol !== PROTOCOL) {
          return { ok: false, reason: "Unexpected protocol." };
        }

        if (typeof data.type !== "string" || !allowedTypes.has(data.type)) {
          return { ok: false, reason: "Unexpected or missing message type." };
        }

        if (typeof data.id !== "string" || data.id.length < 1 || data.id.length > 100) {
          return { ok: false, reason: "Invalid message id." };
        }

        if (
          typeof data.timestamp !== "number" ||
          !Number.isFinite(data.timestamp) ||
          Math.abs(Date.now() - data.timestamp) > 5 * 60 * 1000
        ) {
          return { ok: false, reason: "Invalid or stale timestamp." };
        }

        if (!isPlainObject(data.payload)) {
          return { ok: false, reason: "Payload must be a plain object." };
        }

        return { ok: true, message: data };
      }

      function validateChildInboundMessage(data) {
        const base = validateBaseMessage(
          data,
          new Set([MessageType.PING, MessageType.SET_COLOR])
        );

        if (!base.ok) return base;

        const message = base.message;
        const payload = message.payload;

        if (message.type === MessageType.PING) {
          if (typeof payload.text !== "string" || payload.text.length > 200) {
            return { ok: false, reason: "Invalid PING payload." };
          }
        }

        if (message.type === MessageType.SET_COLOR) {
          if (
            typeof payload.color !== "string" ||
            !/^#[0-9a-fA-F]{6}$/.test(payload.color)
          ) {
            return { ok: false, reason: "Invalid SET_COLOR payload." };
          }
        }

        return { ok: true, message: message };
      }

      function postToParent(type, payload) {
        const message = createMessage(type, payload);
        window.parent.postMessage(message, TRUSTED_PARENT_ORIGIN);
        log("Child sent " + type + " to " + TRUSTED_PARENT_ORIGIN, message);
      }

      window.addEventListener("message", function (event) {
        if (!TRUSTED_PARENT_ORIGINS.has(event.origin)) {
          log("Child rejected message from untrusted origin: " + event.origin);
          return;
        }

        if (event.source !== window.parent) {
          log("Child rejected message from unknown window.");
          return;
        }

        const validation = validateChildInboundMessage(event.data);

        if (!validation.ok) {
          log("Child rejected malformed message: " + validation.reason, event.data);

          postToParent(MessageType.ERROR, {
            code: "INVALID_MESSAGE",
            message: validation.reason
          });

          return;
        }

        const message = validation.message;

        if (message.type === MessageType.PING) {
          log("Child processed PING.", message);

          postToParent(MessageType.PONG, {
            text: "Hello parent. I received your PING.",
            receivedMessageId: message.id
          });
        }

        if (message.type === MessageType.SET_COLOR) {
          log("Child processed SET_COLOR.", message);
          document.body.style.backgroundColor = message.payload.color;

          postToParent(MessageType.PONG, {
            text: "Background color updated.",
            receivedMessageId: message.id
          });
        }
      });

      log("Child ready. Trusted parent origin: " + TRUSTED_PARENT_ORIGIN);
    }());
  <\/script>
</body>
</html>`;
      log("Parent ready. Trusted child origin: " + CURRENT_ORIGIN);
    }());
  </script>
</body>
</html>