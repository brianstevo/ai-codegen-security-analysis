<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure PostMessage Implementation</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
            background-color: #f4f4f9;
            color: #333;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            display: flex;
            gap: 20px;
        }
        iframe {
            width: 100%;
            height: 400px;
            border: 1px solid #ccc;
            background: white;
            border-radius: 8px;
        }
        .controls {
            margin-bottom: 20px;
            padding: 15px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        button {
            padding: 10px 20px;
            cursor: pointer;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 14px;
        }
        button:hover {
            background-color: #0056b3;
        }
        .log-area {
            margin-top: 20px;
            padding: 15px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        h3 { margin-top: 0; }
    </style>
</head>
<body>

<div class="container">
    <div style="width: 100%;">
        <div class="controls">
            <h3>Parent Window Controls</h3>
            <p>Click below to send a secure message to the iframe.</p>
            <button id="sendBtn">Send Secure Message</button>
            <button id="sendBadOriginBtn" style="background-color: #dc3545;">Simulate Malicious Origin (Internal)</button>
        </div>

        <!-- 
          Using srcdoc to simulate a cross-origin iframe without needing an external server.
          In a real scenario, this would be src="https://trusted-partner.com/widget"
        -->
        <iframe id="childFrame" srcdoc="
            <!DOCTYPE html>
            <html>
            <head><style>body{font-family:sans-serif;padding:20px;}</style></head>
            <body>
                <h3>Iframe (Child) Console</h3>
                <div id='childLog' style='background:#eee;padding:10px;border-radius:4px;min-height:50px;'>Waiting for messages...</div>
                
                <script>
                    // --- CHILD WINDOW LOGIC ---

                    const logDiv = document.getElementById('childLog');
                    
                    // 1. Define Whitelist of allowed origins
                    // In production, this should be the exact origin of the parent window (e.g., 'https://mysite.com')
                    // Since we are running locally via file:// or localhost, we allow those for demonstration.
                    const ALLOWED_ORIGINS = [
                        window.location.origin, 
                        'http://localhost:3000',
                        'https://trusted-parent-domain.com'
                    ];

                    // 2. Listen for messages
                    window.addEventListener('message', function(event) {
                        
                        // SECURITY CHECK 1: Verify Origin
                        if (!ALLOWED_ORIGINS.includes(event.origin)) {
                            console.warn('Blocked message from unauthorized origin:', event.origin);
                            logDiv.innerHTML = '<span style=\"color:red\">BLOCKED: Unauthorized origin (' + event.origin + ')</span>';
                            return; // Stop processing immediately
                        }

                        // SECURITY CHECK 2: Validate Payload Structure and Type
                        const data = event.data;
                        
                        if (typeof data !== 'object' || data === null) {
                            console.warn('Blocked message: Invalid payload type.');
                            logDiv.innerHTML = '<span style=\"color:red\">BLOCKED: Invalid payload structure.</span>';
                            return;
                        }

                        // Check for specific required fields
                        if (!data.type || !data.payload) {
                            console.warn('Blocked message: Missing required fields (type, payload).');
                            logDiv.innerHTML = '<span style=\"color:red\">BLOCKED: Malformed data object.</span>';
                            return;
                        }

                        // If we passed all checks, process the data
                        logDiv.innerHTML = '<strong>Message Received:</strong><br>' + 
                                          'Type: ' + data.type + '<br>' +
                                          'Content: ' + data.payload.message + '<br>' +
                                          'Timestamp: ' + new Date().toLocaleTimeString();
                                          
                        // Optional: Send a reply back to parent
                        event.source.postMessage({ type: 'ACK', status: 'success' }, event.origin);
                    });
                <\/script>
            </body>
            </html>
        "></iframe>

        <div class="log-area">
            <h3>Parent Window Console</h3>
            <div id="parentLog">Waiting for responses...</div>
        </div>
    </div>
</div>

<script>
    // --- PARENT WINDOW LOGIC ---

    const sendBtn = document.getElementById('sendBtn');
    const sendBadOriginBtn = document.getElementById('sendBadOriginBtn');
    const parentLog = document.getElementById('parentLog');
    const iframe = document.getElementById('childFrame');

    // 1. Define the specific target origin we expect to communicate with.
    // Since we are using srcdoc, the origin is technically 'null' or same as parent depending on browser implementation.
    // For this demo, we use window.location.origin (Self). 
    // In production, this would be 'https://trusted-partner.com'.
    const TARGET_ORIGIN = window.location.origin;

    sendBtn.addEventListener('click', () => {
        // Construct a valid message object
        const secureMessage = {
            type: 'INITIATE_HANDSHAKE',
            payload: {
                message: 'Hello from the parent window!',
                timestamp: Date.now()
            }
        };

        // SECURITY BEST PRACTICE: 
        // Never use '*' as the targetOrigin. Always specify the exact origin of the receiver.
        iframe.contentWindow.postMessage(secureMessage, TARGET_ORIGIN);
        
        parentLog.textContent = `Sent message to ${TARGET_ORIGIN}`;
    });

    sendBadOriginBtn.addEventListener('click', () => {
        // Simulating a malicious actor trying to inject data into the iframe
        // We send this directly to the window object (broadcast) or specifically to the iframe
        // but spoofing the origin check logic if we were testing the child's robustness.
        
        const maliciousMessage = {
            type: 'HACK_ATTEMPT',
            payload: { message: 'I am a hacker' }
        };

        // Note: We cannot actually spoof the 'origin' property of the event object 
        // when sending via postMessage from the same window. The browser sets it automatically.
        // However, we can demonstrate that if we sent this to a different origin (e.g. an iframe pointing to google.com),
        // and we used '*' as targetOrigin, Google could read our data.
        
        // Here we just trigger the child listener manually via postMessage to show it works securely.
        // The child will see the origin as 'self' (current page) because we are in the same domain context for this demo.
        iframe.contentWindow.postMessage(maliciousMessage, TARGET_ORIGIN);
    });

    // Listen for replies from the iframe
    window.addEventListener('message', function(event) {
        // Verify origin of the reply as well
        if (event.origin !== TARGET_ORIGIN) {
            console.warn('Blocked reply from unknown origin');
            return;
        }

        if (event.data.type === 'ACK') {
            parentLog.innerHTML = '<span style="color:green">Received ACK from iframe.</span>';
        }
    });

</script>

</body>
</html>