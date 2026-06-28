<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PostMessage Communication Demo</title>
    <style>
        body {
            font-family: sans-serif;
            max-width: 800px;
            margin: 2rem auto;
            padding: 0 1rem;
            background-color: #f4f4f9;
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { margin-top: 0; color: #333; }
        .controls {
            margin-bottom: 2rem;
            padding-bottom: 2rem;
            border-bottom: 1px solid #eee;
        }
        button {
            background-color: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
        }
        button:hover { background-color: #0056b3; }
        .log-area {
            background: #222;
            color: #0f0;
            padding: 1rem;
            border-radius: 4px;
            font-family: monospace;
            height: 200px;
            overflow-y: auto;
            white-space: pre-wrap;
        }
        .log-entry { margin-bottom: 4px; }
        .log-error { color: #ff5555; }
        .log-info { color: #55aaff; }
        iframe {
            width: 100%;
            height: 300px;
            border: 1px solid #ccc;
            border-radius: 4px;
            background-color: #fff;
        }
    </style>
</head>
<body>

<div class="container">
    <h1>PostMessage Communication</h1>
    
    <div class="controls">
        <p>Click the button to send a message to the iframe.</p>
        <button id="sendBtn">Send Message</button>
    </div>

    <div class="log-area" id="mainLog">
        <div class="log-entry">[Main Window] Ready.</div>
    </div>

    <!-- 
      Using a data: URI to simulate a separate context (iframe).
      The origin of a data: URI is 'null'.
    -->
    <iframe id="receiverFrame" src="data:text/html;charset=utf-8,%3Cscript%3E%3C/script%3E"></iframe>
</div>

<script>
    // --- Main Window (Sender) Logic ---

    const iframe = document.getElementById('receiverFrame');
    const sendBtn = document.getElementById('sendBtn');
    const mainLog = document.getElementById('mainLog');

    // Helper to log to the main window
    function logMain(message, type = 'normal') {
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.textContent = `[Main Window] ${message}`;
        mainLog.appendChild(entry);
        mainLog.scrollTop = mainLog.scrollHeight;
    }

    // The explicit target origin. 
    // For a data: URI iframe, the origin is 'null'.
    const TARGET_ORIGIN = 'null';

    sendBtn.addEventListener('click', () => {
        // Constructing a structured payload
        const payload = {
            type: 'USER_ACTION',
            payload: {
                action: 'ping',
                timestamp: Date.now()
            }
        };

        logMain(`Sending message to ${TARGET_ORIGIN}...`);
        
        // Sending message with explicit target origin (never '*')
        iframe.contentWindow.postMessage(payload, TARGET_ORIGIN);
    });

    // --- Main Window (Listener) Logic ---
    // The main window also listens for responses from the iframe
    window.addEventListener('message', (event) => {
        // 1. Verify event.origin against a whitelist
        // We whitelist 'null' because the iframe is a data: URI
        const whitelist = ['null'];
        
        if (!whitelist.includes(event.origin)) {
            logMain(`Blocked message from unauthorized origin: ${event.origin}`, 'error');
            return;
        }

        // 2. Validate structure and type of payload
        if (!event.data || typeof event.data !== 'object') {
            logMain('Invalid payload structure: data is not an object', 'error');
            return;
        }

        // Check required fields and types
        if (typeof event.data.type !== 'string' || 
            typeof event.data.payload !== 'object' || 
            event.data.payload === null) {
            logMain('Invalid payload types: type must be string, payload must be object', 'error');
            return;
        }

        logMain(`Received valid response: ${JSON.stringify(event.data)}`);
    });

    // --- Iframe (Receiver) Logic ---
    // We inject this script into the iframe via the data: URI source
    const receiverScript = `
        <script>
            (function() {
                const logArea = document.createElement('div');
                logArea.style.cssText = 'background:#eef; padding:10px; margin-top:10px; border:1px solid #ccc;';
                document.body.appendChild(logArea);

                function logIframe(msg) {
                    const entry = document.createElement('div');
                    entry.textContent = \`[Iframe] \${msg}\`;
                    logArea.appendChild(entry);
                    logArea.scrollTop = logArea.scrollHeight;
                }

                // Whitelist for the iframe
                const whitelist = ['null'];

                window.addEventListener('message', (event) => {
                    // 1. Verify event.origin against a whitelist
                    if (!whitelist.includes(event.origin)) {
                        logIframe(\`Blocked message from unauthorized origin: \${event.origin}\`);
                        return;
                    }

                    // 2. Validate structure and type of payload
                    if (!event.data || typeof event.data !== 'object') {
                        logIframe('Invalid payload structure: data is not an object');
                        return;
                    }

                    if (typeof event.data.type !== 'string' || typeof event.data.payload !== 'object') {
                        logIframe('Invalid payload types: type must be string, payload must be object');
                        return;
                    }

                    logIframe(\`Received valid message: \${JSON.stringify(event.data)}\`);

                    // Process the data
                    if (event.data.type === 'USER_ACTION') {
                        const response = {
                            type: 'SYSTEM_RESPONSE',
                            payload: {
                                status: 'acknowledged',
                                receivedAt: Date.now()
                            }
                        };
                        // Send response back to main window with explicit origin
                        event.source.postMessage(response, event.origin);
                    }
                });
            })();
        <\/script>
    `;

    // Inject the receiver script into the iframe
    iframe.srcdoc = receiverScript;

</script>

</body>
</html>