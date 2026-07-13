```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PostMessage Communication Demo</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            gap: 20px;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            flex: 1;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h2 {
            margin-top: 0;
            color: #333;
        }
        .messages {
            background: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px;
            max-height: 300px;
            overflow-y: auto;
            margin: 10px 0;
        }
        .message {
            padding: 8px;
            margin: 5px 0;
            border-left: 3px solid #007bff;
            background: #f0f7ff;
        }
        .message.error {
            border-left-color: #dc3545;
            background: #ffe5e5;
        }
        .message.success {
            border-left-color: #28a745;
            background: #e5ffe5;
        }
        input, button {
            padding: 8px 12px;
            margin: 5px 0;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        button {
            background: #007bff;
            color: white;
            cursor: pointer;
            border: none;
        }
        button:hover {
            background: #0056b3;
        }
        textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
        }
        #parentFrame {
            width: 100%;
            height: 400px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Parent Window</h2>
        <p>This demonstrates secure postMessage communication with origin validation and message payload verification.</p>
        
        <div>
            <h3>Send Message to Child</h3>
            <input type="text" id="parentMessage" placeholder="Enter message to child" value="Hello from parent">
            <button onclick="sendToChild()">Send to Child</button>
        </div>

        <div>
            <h3>Received Messages</h3>
            <div class="messages" id="parentMessages"></div>
        </div>

        <div>
            <h3>Child Frame</h3>
            <iframe id="parentFrame"></iframe>
        </div>
    </div>

    <div class="container">
        <h2>Child Window (Iframe)</h2>
        <p>Messages received from parent are validated before processing.</p>
        
        <div>
            <h3>Send Message to Parent</h3>
            <input type="text" id="childMessage" placeholder="Enter message to parent" value="Hello from child">
            <button onclick="sendToParent()">Send to Parent</button>
        </div>

        <div>
            <h3>Received Messages</h3>
            <div class="messages" id="childMessages"></div>
        </div>

        <div>
            <h3>Message Log</h3>
            <textarea id="eventLog" readonly rows="10"></textarea>
        </div>
    </div>

    <script>
        // ===== CONFIGURATION =====
        const ALLOWED_ORIGINS = {
            'parent': window.location.origin,
            'child': window.location.origin
        };

        // Message payload schema for validation
        const MESSAGE_SCHEMA = {
            type: 'object',
            required: ['type', 'data'],
            properties: {
                type: { enum: ['text', 'data', 'command'] },
                data: { type: 'string' },
                timestamp: { type: 'number' },
                sender: { type: 'string' }
            }
        };

        // ===== UTILITY FUNCTIONS =====
        function validateOrigin(origin, context = 'parent') {
            const allowed = ALLOWED_ORIGINS[context];
            if (origin !== allowed) {
                console.warn(`Origin mismatch: received ${origin}, expected ${allowed}`);
                return false;
            }
            return true;
        }

        function validateMessageSchema(message) {
            if (!message || typeof message !== 'object') {
                console.error('Message must be an object');
                return false;
            }

            if (!message.type) {
                console.error('Message must have a type property');
                return false;
            }

            if (!MESSAGE_SCHEMA.properties.type.enum.includes(message.type)) {
                console.error(`Invalid message type: ${message.type}`);
                return false;
            }

            if (typeof message.data !== 'string') {
                console.error('Message data must be a string');
                return false;
            }

            if (message.timestamp && typeof message.timestamp !== 'number') {
                console.error('Message timestamp must be a number');
                return false;
            }

            if (message.sender && typeof message.sender !== 'string') {
                console.error('Message sender must be a string');
                return false;
            }

            return true;
        }

        function addLog(elementId, message, type = 'info') {
            const messagesDiv = document.getElementById(elementId);
            const messageEl = document.createElement('div');
            messageEl.className = `message ${type}`;
            const timestamp = new Date().toLocaleTimeString();
            messageEl.textContent = `[${timestamp}] ${message}`;
            messagesDiv.appendChild(messageEl);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        // ===== PARENT WINDOW CODE =====
        function initParent() {
            // Create and load the iframe
            const iframe = document.getElementById('parentFrame');
            const iframeContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Child Window</title>
                </head>
                <body>
                    <script>
                        ${childWindowScript.toString().slice(14, -1)}
                    </script>
                </body>
                </html>
            `;
            
            iframe.onload = () => {
                // Listen for messages from child
                window.addEventListener('message', handleParentMessage);
                console.log('Parent window ready to receive messages from child');
            };

            const blob = new Blob([iframeContent], { type: 'text/html' });
            iframe.src = URL.createObjectURL(blob);
        }

        function handleParentMessage(event) {
            // Step 1: Validate origin
            if (!validateOrigin(event.origin, 'parent')) {
                addLog('parentMessages', 'SECURITY: Rejected message from untrusted origin', 'error');
                return;
            }

            // Step 2: Validate message schema
            if (!validateMessageSchema(event.data)) {
                addLog('parentMessages', `VALIDATION ERROR: Invalid message format - ${JSON.stringify(event.data)}`, 'error');
                return;
            }

            // Step 3: Process valid message
            const { type, data, timestamp, sender } = event.data;
            const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : 'unknown';
            addLog('parentMessages', `From ${sender || 'child'} [${type}]: ${data}`,