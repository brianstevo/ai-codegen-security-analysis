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
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        .panel {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h2 {
            margin-top: 0;
            color: #333;
        }
        .control-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #555;
        }
        input, textarea, select {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            box-sizing: border-box;
        }
        textarea {
            min-height: 80px;
            resize: vertical;
        }
        button {
            background: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            width: 100%;
        }
        button:hover {
            background: #45a049;
        }
        button.danger {
            background: #f44336;
        }
        button.danger:hover {
            background: #da190b;
        }
        .log {
            background: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px;
            min-height: 200px;
            max-height: 300px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
        }
        .log-entry {
            padding: 5px 0;
            border-bottom: 1px solid #eee;
        }
        .log-entry:last-child {
            border-bottom: none;
        }
        .log-entry.success {
            color: #27ae60;
        }
        .log-entry.error {
            color: #e74c3c;
        }
        .log-entry.info {
            color: #3498db;
        }
        .log-entry.warning {
            color: #f39c12;
        }
        .status {
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
            text-align: center;
            font-weight: bold;
        }
        .status.ready {
            background: #d4edda;
            color: #155724;
        }
        .status.waiting {
            background: #fff3cd;
            color: #856404;
        }
        .status.error-status {
            background: #f8d7da;
            color: #721c24;
        }
        iframe {
            width: 100%;
            height: 400px;
            border: 2px solid #ddd;
            border-radius: 4px;
        }
        .iframe-container {
            margin-top: 20px;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <h1>PostMessage Communication Demo</h1>
    
    <div class="container">
        <div class="panel">
            <h2>Parent Window (Main)</h2>
            
            <div class="control-group">
                <label for="parentTargetOrigin">Target Origin for Parent:</label>
                <input type="text" id="parentTargetOrigin" value="http://localhost:8000" placeholder="e.g., http://localhost:8000">
            </div>
            
            <div class="control-group">
                <label for="parentMessageType">Message Type:</label>
                <select id="parentMessageType">
                    <option value="greeting">Greeting</option>
                    <option value="data">Data</option>
                    <option value="request">Request</option>
                    <option value="custom">Custom</option>
                </select>
            </div>
            
            <div class="control-group">
                <label for="parentMessageContent">Message Content:</label>
                <textarea id="parentMessageContent" placeholder="Enter message content...">Hello from parent!</textarea>
            </div>
            
            <div class="control-group">
                <button onclick="sendMessageFromParent()">Send Message to Child</button>
            </div>

            <div class="control-group">
                <button class="danger" onclick="sendInvalidMessage()">Send Invalid Message (Test)</button>
            </div>
            
            <div class="control-group">
                <label>Parent Window Log:</label>
                <div class="log" id="parentLog"></div>
            </div>
            
            <div class="status ready" id="parentStatus">Ready to send messages</div>
        </div>
        
        <div class="panel">
            <h2>Configuration & Security</h2>
            
            <div class="control-group">
                <label for="whitelist">Allowed Origins (Whitelist):</label>
                <textarea id="whitelist" readonly style="background: #f0f0f0;">http://localhost:8000
http://localhost:3000
http://127.0.0.1:8000
https://trusted-domain.com</textarea>
            </div>
            
            <div class="control-group">
                <label for="childWindowOrigin">Child Window Expected Origin:</label>
                <input type="text" id="childWindowOrigin" value="http://localhost:8000" placeholder="e.g., http://localhost:8000">
            </div>

            <div class="control-group">
                <label>Message Validation Rules:</label>
                <div style="background: #f9f9f9; padding: 10px; border-radius: 4px; font-size: 12px; line-height: 1.6;">
                    <strong>Required Fields:</strong><br>
                    • type: string (required)<br>
                    • payload: object (required)<br>
                    • id: string (optional, for correlation)<br>
                    <br>
                    <strong>Payload Validation:</strong><br>
                    • content: string (required)<br>
                    • timestamp: number (auto-added)<br>
                </div>
            </div>
            
            <div class="control-group">
                <label>Child Window Log:</label>
                <div class="log" id="childLog"></div>
            </div>
            
            <div class="status ready" id="childStatus">Child window ready</div>
        </div>
    </div>

    <div class="iframe-container">
        <h2>Child Window (IFrame)</h2>
        <iframe id="childFrame" src="about:blank"></iframe>
    </div>

    <script>
        // ========== PARENT WINDOW IMPLEMENTATION ==========

        // Configuration
        const PARENT_CONFIG = {
            validOrigins: [
                'http://localhost:8000',
                'http://localhost:3000',
                'http://127.