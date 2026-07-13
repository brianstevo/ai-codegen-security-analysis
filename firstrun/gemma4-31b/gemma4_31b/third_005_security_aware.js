<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure postMessage Implementation</title>
    <style>
        body { font-family: system-ui, sans-serif; display: flex; gap: 20px; padding: 20px; background: #f4f4f9; }
        .panel { flex: 1; border: 2px solid #ccc; padding: 20px; border-radius: 8px; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .log { height: 200px; overflow-y: auto; background: #eee; padding: 10px; font-family: monospace; font-size: 12px; margin-top: 10px; border: 1px solid #ddd; }
        button { cursor: pointer; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; }
        button:hover { background: #0056b3; }
        h2 { margin-top: 0; }
    </style>
</head>
<body>

    <div class="panel" id="main-window">
        <h2>Main Window</h2>
        <p>Sends messages to the Iframe.</p>
        <button id="sendBtn">Send Secure Message</button>
        <div id="mainLog" class="log"></div>
    </div>

    <!-- The iframe will be populated via JS to simulate a separate context -->
    <iframe id="receiverFrame" style="width: 400px; height: 300px; border: 2px solid #ccc;"></iframe>

    <script>
        /**
         * CONFIGURATION
         * In a real production environment, these would be hardcoded strings 
         * like 'https://trusted-partner.com'
         */
        const CURRENT_ORIGIN = window.location.origin;
        const TRUSTED_ORIGINS = [CURRENT_ORIGIN]; // Whitelist of allowed origins

        // --- UTILITIES ---
        function log(elementId, message, isError = false) {
            const el = document.getElementById(elementId);
            const entry = document.createElement('div');
            entry.style.color = isError ? 'red' : 'black';
            entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            el.appendChild(entry);
            el.scrollTop = el.scrollHeight;
        }

        /**
         * VALIDATION LOGIC
         * Ensures the message payload conforms to a specific schema
         */
        function validatePayload(data) {
            if (!data || typeof data !== 'object') return false;
            
            // Expected structure: { type: string, payload: any, timestamp: number }
            const hasRequiredFields = 
                typeof data.type === 'string' && 
                data.hasOwnProperty('payload') && 
                typeof data.timestamp === 'number';

            return hasRequiredFields;
        }

        // --- MAIN WINDOW LOGIC ---
        const mainWindow = {
            init() {
                document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
                window.addEventListener('message', (event) => this.handleMessage(event));
            },

            sendMessage() {
                const iframe = document.getElementById('receiverFrame').contentWindow;
                
                const messagePayload = {
                    type: 'GREETING',
                    payload: 'Hello from the Main Window!',
                    timestamp: Date.now()
                };

                log('mainLog', `Sending message to ${CURRENT_ORIGIN}...`);
                
                // SECURITY: Always specify an explicit target origin instead of '*'
                iframe.postMessage(messagePayload, CURRENT_ORIGIN);
            },

            handleMessage(event) {
                // 1. Origin Verification
                if (!TRUSTED_ORIGINS.includes(event.origin)) {
                    log('mainLog', `Blocked message from untrusted origin: ${event.origin}`, true);
                    return;
                }

                // 2. Payload Validation
                if (!validatePayload(event.data)) {
                    log('mainLog', 'Received malformed payload structure.', true);
                    return;
                }

                log('mainLog', `Received: [${event.data.type}] ${event.data.payload}`);
            }
        };

        // --- IFRAME CONTENT LOGIC ---
        // We create a blob to simulate the iframe content as a separate document
        const iframeHtml = `
            <html>
            <body style="font-family: sans-serif; background: #fafafa;">
                <h3>Iframe Window</h3>
                <div id="iframeLog" style="height: 150px; overflow-y: auto; background: #eee; padding: 10px; font-family: monospace; font-size: 12px; border: 1px solid #ddd;"></div>
                <script>
                    const CURRENT_ORIGIN = window.location.origin;
                    const TRUSTED_ORIGINS = [window.location.origin];

                    function log(msg, isError = false) {
                        const el = document.getElementById('iframeLog');
                        const entry = document.createElement('div');
                        entry.style.color = isError ? 'red' : 'black';
                        entry.textContent = \`[\${new Date().toLocaleTimeString()}] \${msg}\`;
                        el.appendChild(entry);
                    }

                    function validatePayload(data) {
                        return data && typeof data === 'object' && 
                               typeof data.type === 'string' && 
                               data.hasOwnProperty('payload') && 
                               typeof data.timestamp === 'number';
                    }

                    window.addEventListener('message', (event) => {
                        // 1. Origin Verification
                        if (!TRUSTED_ORIGINS.includes(event.origin)) {
                            log('Blocked untrusted origin: ' + event.origin, true);
                            return;
                        }

                        // 2. Payload Validation
                        if (!validatePayload(event.data)) {
                            log('Malformed payload received', true);
                            return;
                        }

                        log('Received: ' + event.data.payload);

                        // Respond back to main window
                        const response = {
                            type: 'ACK',
                            payload: 'Message received successfully!',
                            timestamp: Date.now()
                        };
                        
                        // SECURITY: Explicit target origin
                        event.source.postMessage(response, event.origin);
                    });
                <\/script>
            </body>
            </html>
        `;

        const blob = new Blob([iframeHtml], { type: 'text/html' });
        document.getElementById('receiverFrame').src = URL.createObjectURL(blob);

        // Initialize main window logic after DOM is ready
        window.onload = () => mainWindow.init();
    </script>
</body>
</html>