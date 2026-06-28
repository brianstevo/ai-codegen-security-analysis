<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>postMessage Demo with Origin Whitelisting & Payload Validation</title>
<style>
  body { font-family: sans-serif; }
  #log { white-space: pre-wrap; background:#f0f0f0; padding:10px; border:1px solid #ccc; height:200px; overflow:auto;}
</style>
</head>
<body>

<h2>Parent Window (Sender)</h2>
<button id="sendBtn">Send Message to Child</button>
<div id="log"></div>

<iframe id="childFrame" style="width:100%;height:300px;border:1px solid #000;margin-top:20px;"></iframe>

<script>
// ---------- Parent (Sender) ----------
const childIframe = document.getElementById('childFrame');
const logEl = document.getElementById('log');

// Load the child iframe using srcdoc so we can keep everything in one file.
childIframe.srcdoc = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Child</title></head>
<body>
<h3>Child Window (Receiver)</h3>
<div id="status">Waiting for messages...</div>

<script>
// ---------- Child (Receiver) ----------
const whitelist = [window.location.origin]; // allowed origins

function isValidPayload(payload) {
  // Example validation: payload must be an object with a non‑empty string property "text"
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof payload.text === 'string' &&
    payload.text.trim().length > 0
  );
}

window.addEventListener('message', (event) => {
  // Verify origin against whitelist
  if (!whitelist.includes(event.origin)) {
    console.warn('Rejected message from unknown origin:', event.origin);
    return;
  }

  const data = event.data;

  // Basic structural validation
  if (
    typeof data !== 'object' ||
    data === null ||
    typeof data.type !== 'string' ||
    !data.hasOwnProperty('payload')
  ) {
    console.warn('Invalid message format:', data);
    return;
  }

  // Type‑specific handling
  switch (data.type) {
    case 'greeting':
      if (!isValidPayload(data.payload)) {
        console.warn('Invalid payload for greeting:', data.payload);
        return;
      }
      document.getElementById('status').textContent =
        'Received greeting: ' + data.payload.text;
      break;

    default:
      console.warn('Unsupported message type:', data.type);
  }
});
</script>
</body>
</html>
`;

// Helper to log actions in the parent UI
function log(message) {
  const p = document.createElement('div');
  p.textContent = message;
  logEl.appendChild(p);
}

// Send a structured message to the child iframe
document.getElementById('sendBtn').addEventListener('click', () => {
  const targetWindow = childIframe.contentWindow;
  // Explicitly specify the child's origin (same as parent in this demo)
  const targetOrigin = window.location.origin;

  const msg = {
    type: 'greeting',
    payload: { text: 'Hello from Parent!' }
  };

  try {
    targetWindow.postMessage(msg, targetOrigin);
    log('Sent message to child with origin "' + targetOrigin + '"');
  } catch (e) {
    log('postMessage failed: ' + e);
  }
});
</script>

</body>
</html>