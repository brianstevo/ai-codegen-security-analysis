<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Parent ↔ Iframe postMessage Demo</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20px; }
  iframe { width: 100%; height: 200px; border: 1px solid #ccc; }
  #log { white-space: pre-wrap; background:#f9f9f9; padding:10px; border:1px solid #ddd; max-height:150px; overflow:auto;}
</style>
</head>
<body>

<h2>Parent Window</h2>
<button id="sendBtn">Send Message to Iframe</button>
<div id="log"></div>

<iframe id="childFrame" srcdoc="
<!DOCTYPE html>
<html lang='en'>
<head><meta charset='UTF-8'><title>Iframe</title></head>
<body style='font-family:Arial; margin:10px;'>
<h3>Iframe Content</h3>
<div id='msgLog' style='white-space:pre-wrap; background:#eef; padding:5px; border:1px solid #99;'></div>

<script>
// Listen for messages from the parent
window.addEventListener('message', function(event) {
    // For security, you may want to verify event.origin here.
    const log = document.getElementById('msgLog');
    const data = typeof event.data === 'object' ? JSON.stringify(event.data) : String(event.data);
    log.textContent += `Received (${event.origin}): ${data}\\n`;
});
</script>
</body>
</html>
"></iframe>

<script>
// Function to post a message from the parent to an iframe
function postMessageToIframe(iframeElement, message, targetOrigin = '*') {
    if (!iframeElement || !iframeElement.contentWindow) {
        console.error('Invalid iframe element provided.');
        return;
    }
    iframeElement.contentWindow.postMessage(message, targetOrigin);
}

// Demo UI handling
const logDiv = document.getElementById('log');
document.getElementById('sendBtn').addEventListener('click', () => {
    const iframe = document.getElementById('childFrame');
    const payload = { timestamp: Date.now(), text: 'Hello from parent!' };
    postMessageToIframe(iframe, payload, '*'); // Use '*' for demo; replace with specific origin in production
    logDiv.textContent += `Sent to iframe: ${JSON.stringify(payload)}\\n`;
});
</script>

</body>
</html>