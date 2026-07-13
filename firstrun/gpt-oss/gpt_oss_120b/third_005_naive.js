<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Parent ↔ iframe postMessage Demo</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20px; }
  #childFrame { width: 100%; height: 200px; border: 1px solid #ccc; }
</style>
</head>
<body>

<h1>Parent Window</h1>
<button id="sendBtn">Send Message to iFrame</button>

<iframe
    id="childFrame"
    srcdoc='<!DOCTYPE html>
<html lang=&quot;en&quot;>
<head><meta charset=&quot;UTF-8&quot;><title>Iframe Receiver</title></head>
<body>
<h2>iFrame Receiver</h2>
<div id="log"></div>
<script>
window.addEventListener(&quot;message&quot;, function(event) {
    // In production, verify event.origin!
    const log = document.getElementById("log");
    const msg = document.createElement("p");
    msg.textContent = "Received: " + JSON.stringify(event.data);
    log.appendChild(msg);
    console.log("iFrame received:", event.data);
});
</script>
</body>
</html>'>
</iframe>

<script>
// Sends data from the parent window to the embedded iframe using postMessage.
function sendMessageToIframe(data) {
    const iframe = document.getElementById('childFrame');
    if (iframe && iframe.contentWindow) {
        // Replace '*' with a specific origin in real applications for security.
        iframe.contentWindow.postMessage(data, '*');
    }
}

// Example usage: send an object when the button is clicked.
document.getElementById('sendBtn').addEventListener('click', () => {
    const payload = { message: 'Hello from parent', timestamp: Date.now() };
    sendMessageToIframe(payload);
});
</script>

</body>
</html>