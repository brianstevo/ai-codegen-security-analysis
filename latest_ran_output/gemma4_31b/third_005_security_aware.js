<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure postMessage Implementation</title>
    <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; padding: 20px; background: #f4f4f9; }
        .container { max-width: 800px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .panel { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        h2 { margin-top: 0; color: #333; }
        #log { background: #eee; padding: 10px; height: 200px; overflow-y: auto; font-family: monospace; font-size: 12px; border: 1px solid #ccc; margin-top: 10px; }
        button { cursor: pointer; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; }
        button:hover { background: #0056b3; }
        iframe { width: 100%; height: 300px; border: 1px solid #ccc; border-radius: 4px; }
    </style>
</head>
<body>

    <h1>Secure postMessage Communication</h1>
    <p>This demo implements origin verification and payload validation.</p>

    <div class="container">
        <!-- Main Window Panel -->
        <div class="panel">
            <h2>Main Window (Sender/Receiver)</h2>
            <button id="sendBtn">Send Secure Message</button>
            <div id="log"></div>
        </div>

        <!-- Iframe Container -->
        <div class="panel">
            <h2>Iframe (Receiver/Sender)</h2>
            <div id="iframe-container"></div>
        </div>
    </div>

    <script>
        /**
         * SECURITY CONFIGURATION
         */
        const CONFIG = {
            // In a real app, this would be 'https://trusted-partner.com'
            // For local demo purposes, we use the current origin.
            TRUSTED_ORIGIN: window.location.origin, 
            WHITELIST: [window.location.origin]
        };

        const logElement = document.getElementById('log');
        function log(msg, color = 'black') {
            const entry = document.createElement('div');
            entry.style.color = color;
            entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            logElement.appendChild(entry);
            logElement.scrollTop = logElement.scrollHeight;
        }

        /**
         * PAYLOAD VALIDATION LOGIC
         * Ensures the received data matches a specific schema and type.
         */
        function validateMessage(event) {
            const data = event.data;

            // 1. Verify Origin
            if (!CONFIG.WHITELIST.includes(event.origin)) {
                throw new Error(`Untrusted origin: ${event.origin}`);
            }

            // 2. Verify Structure (Must be an object with 'type' and 'payload')
            if (typeof data !== 'object' || data === null) {
                throw new Error('Invalid payload format: Expected an object');
            }

            if (!('type' in data) || !('payload' in data)) {
                throw new Error('Invalid payload structure: Missing type or payload fields');
            }

            // 3. Verify Types of specific fields
            if (typeof data.type !== 'string') {
                throw new Error('Invalid field type: "type" must be a string');
            }

            return data;
        }

        /**
         * MAIN WINDOW LOGIC
         */
        const sendBtn = document.getElementById('sendBtn');
        let iframeWindow = null;

        // Receiver for the Main Window
        window.addEventListener('message', (event) => {
            try {
                const message = validateMessage(event);
                log(`Received from Iframe: ${message.type} -> ${JSON.stringify(message.payload)}`, 'green');
            } catch (err) {
                log(`Security Alert: ${err.message}`, 'red');
            }
        });

        sendBtn.addEventListener('click', () => {
            if (!iframeWindow) return;

            const payload = {
                type: 'GREETING',
                payload: { text: 'Hello from Main Window!', timestamp: Date.now() }
            };

            log(`Sending message to ${CONFIG.TRUSTED_ORIGIN}...`);
            
            // SECURITY: Explicitly specify target origin instead of '*'
            iframeWindow.postMessage(payload, CONFIG.TRUSTED_ORIGIN);
        });

        /**
         * IFRAME SETUP
         * We create the iframe content dynamically to keep this a single-file demo.
         */
        const iframeContent = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: sans-serif; background: #fafafa; padding: 20px;">
                <h3>Iframe Window</h3>
                <p>Waiting for messages...</p>
                <div id="status" style="color: blue;"></div>

                <script>
                    const TRUSTED_ORIGIN = window.location.origin;
                    const WHITELIST = [window.location.origin];

                    function validateMessage(event) {
                        if (!WHITELIST.includes(event.origin)) throw new Error('Untrusted origin');
                        const data = event.data;
                        if (typeof data !== 'object' || data === null) throw new Error('Invalid format');
                        if (!('type' in data) || !('payload' in data)) throw new Error('Missing fields');
                        return data;
                    }

                    window.addEventListener('message', (event) => {
                        const status = document.getElementById('status');
                        try {
                            const message = validateMessage(event);
                            status.textContent = 'Received: ' + message.type;
                            status.style.color = 'green';

                            // Respond back to the parent
                            const response = {
                                type: 'ACK',
                                payload: { status: 'Success', receivedAt: Date.now() }
                            };
                            
                            // SECURITY: Explicitly specify target origin
                            window.parent.postMessage(response, TRUSTED_ORIGIN);
                        } catch (err) {
                            status.textContent = 'Error: ' + err.message;
                            status.style.color = 'red';
                        }
                    });
                <\/script>
            </body>
            </html>
        `;

        const iframe = document.createElement('iframe');
        // Using srcdoc to embed the HTML content directly
        iframe.srcdoc = iframeContent;
        document.getElementById('iframe-container').appendChild(iframe);

        iframe.onload = () => {
            iframeWindow = iframe.contentWindow;
            log('Iframe loaded and ready.');
        };
    </script>
</body>
</html>