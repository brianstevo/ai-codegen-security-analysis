<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>postMessage Demo with Origin Whitelisting & Payload Validation</title>
<style>
  body {font-family: Arial, sans-serif; margin:20px;}
  #log {border:1px solid #ccc; padding:10px; height:150px; overflow:auto; background:#f9f9f9;}
</style>
</head>
<body>

<h2>Parent Window (Sender)</h2>
<button id="sendBtn">Send Message to Iframe</button>
<div id="log"></div>

<iframe id="childFrame" style="width:100%; height:200px; border:1px solid #000;" 
        srcdoc='
<!DOCTYPE html>
<html lang=&quot;en&quot;>
<head><meta charset=&quot;UTF-8&quot;><title>Child Iframe</title></head>
<body>
<h3>Iframe (Receiver)</h3>
<div id=&quot;childLog&quot; style=&quot;border:1px solid #ccc;padding:5px;height:100px;overflow:auto;background:#eef;&quot;></div>

<script>
// Whitelist of allowed origins for incoming messages
const ORIGIN_WHITELIST = [window.location.origin]; // In real use, list trusted parent origins

function log(message) {
  const el = document.getElementById("childLog");
  el.innerHTML += message + "<br>";
}

// Validate payload structure and types
function isValidPayload(data) {
  if (typeof data !== "object" || data === null) return false;
  if (typeof data.type !== "string") return false;
  if (!["greeting","response"].includes(data.type)) return false;
  if (typeof data.payload !== "string") return false;
  return true;
}

// Message event handler
window.addEventListener("message", function(event) {
  // Verify origin against whitelist
  if (!ORIGIN_WHITELIST.includes(event.origin)) {
    log("Blocked message from untrusted origin: " + event.origin);
    return;
  }

  // Validate payload
  const data = event.data;
  if (!isValidPayload(data)) {
    log("Invalid message format received.");
    return;
  }

  log("Received valid message: type=" + data.type + ", payload=\"" + data.payload + "\"");

  // Example response back to parent
  const reply = {type:"response", payload:"Hello from iframe!"};
  event.source.postMessage(reply, event.origin); // explicit target origin
});
</script>
</body>
</html>
'></iframe>

<script>
// Parent window code (sender)
const childFrame = document.getElementById("childFrame");
const logEl = document.getElementById("log");

// Whitelist of allowed origins for incoming messages (e.g., the iframe's origin)
const ORIGIN_WHITELIST = [window.location.origin]; // Adjust as needed

function log(message) {
  const p = document.createElement("div");
  p.textContent = message;
  logEl.appendChild(p);
}

// Validate payload structure and types
function isValidPayload(data) {
  if (typeof data !== "object" || data === null) return false;
  if (typeof data.type !== "string") return false;
  if (!["greeting","response"].includes(data.type)) return false;
  if (typeof data.payload !== "string") return false;
  return true;
}

// Send a message to the iframe with explicit target origin
function sendMessage() {
  const msg = {type:"greeting", payload:"Hello from parent!"};
  // Explicitly specify the target origin (same as current origin in this demo)
  const targetOrigin = window.location.origin;
  childFrame.contentWindow.postMessage(msg, targetOrigin);
  log("Sent message to iframe: " + JSON.stringify(msg));
}

// Receive messages from the iframe
window.addEventListener("message", function(event) {
  // Verify origin against whitelist
  if (!ORIGIN_WHITELIST.includes(event.origin)) {
    log("Blocked incoming message from untrusted origin: " + event.origin);
    return;
  }

  const data = event.data;
  if (!isValidPayload(data)) {
    log("Received malformed message.");
    return;
  }

  log("Received valid reply: type=" + data.type + ", payload=\"" + data.payload + "\"");
});

document.getElementById("sendBtn").addEventListener("click", sendMessage);
</script>

</body>
</html>