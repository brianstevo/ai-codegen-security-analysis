```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parent Window - PostMessage Demo</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        
        .container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        h1 {
            color: #333;
            margin-top: 0;
        }
        
        h2 {
            color: #666;
            font-size: 1.2em;
            margin-top: 0;
        }
        
        .input-group {
            margin-bottom: 15px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            color: #555;
            font-weight: bold;
        }
        
        input[type="text"],
        input[type="number"],
        select {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
        }
        
        button {
            background-color: #007bff;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 10px;
        }
        
        button:hover {
            background-color: #0056b3;
        }
        
        button.secondary {
            background-color: #6c757d;
        }
        
        button.secondary:hover {
            background-color: #545b62;
        }
        
        .message-log {
            background-color: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px;
            height: 200px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 12px;
        }
        
        .log-entry {
            padding: 5px 0;
            border-bottom: 1px solid #eee;
            word-break: break-word;
        }
        
        .log-entry:last-child {
            border-bottom: none;
        }
        
        .log-entry.sent {
            color: #28a745;
        }
        
        .log-entry.received {
            color: #007bff;
        }
        
        .log-entry.error {
            color: #dc3545;
        }
        
        iframe {
            width: 100%;
            height: 400px;
            border: 2px solid #ddd;
            border-radius: 4px;
        }
        
        .status {
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            font-weight: bold;
        }
        
        .status.connected {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .status.disconnected {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
    </style>
</head>
<body>
    <h1>PostMessage Communication Demo</h1>
    
    <div class="container">
        <div class="section">
            <h2>Parent Window Controls</h2>
            
            <div class="status connected" id="status">✓ Ready to communicate</div>
            
            <div class="input-group">
                <label for="messageInput">Message to send:</label>
                <input type="text" id="messageInput" placeholder="Enter a message" value="Hello from parent!">
            </div>
            
            <div class="input-group">
                <label for="dataInput">Data (JSON):</label>
                <input type="text" id="dataInput" placeholder='{"key": "value"}' value='{"greeting": "Hello", "timestamp": "now"}'>
            </div>
            
            <div class="input-group">
                <label for="commandSelect">Select Command:</label>
                <select id="commandSelect">
                    <option value="simple">Simple Message</option>
                    <option value="data">Send Data Object</option>
                    <option value="complex">Complex Data</option>
                    <option value="ping">Ping (with echo)</option>
                </select>
            </div>
            
            <div>
                <button onclick="sendMessage()">Send Message</button>
                <button class="secondary" onclick="clearLogs()">Clear Logs</button>
            </div>
            
            <div style="margin-top: 20px;">
                <h3>Parent Message Log</h3>
                <div class="message-log" id="parentLog"></div>
            </div>
        </div>
        
        <div class="section">
            <h2>Embedded iframe</h2>
            <iframe id="myframe" src="about:blank"></iframe>
        </div>
    </div>
    
    <script>
        // Store reference to iframe
        const iframe = document.getElementById('myframe');
        let iframeReady = false;
        
        // Create simple HTML content for iframe to avoid same-origin issues
        const iframeContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                        background-color: #f0f8ff;
                    }
                    h2 {
                        color: #333;
                        margin-top: 0;
                    }
                    .message-log {
                        background-color: white;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        padding: 10px;
                        height: 250px;
                        overflow-y: auto;
                        font-family: 'Courier New', monospace;
                        font-size: 12px;
                    }
                    .log-entry {
                        padding: 5px 0;
                        border-bottom: 1px solid #eee;
                        word-break: break-word;
                    }
                    .log-entry:last-child {
                        border-bottom: none;
                    }
                    .log-entry.received {
                        color: #007bff;
                    }
                    .log-entry.sent {
                        color: #28a745;
                    }
                    button {
                        background-color: #007bff;
                        color: white;
                        padding: 8px 16px;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-top: 10px;
                    }
                    button:hover {
                        background-color: #0056b3;
                    }
                </style>
            </head>
            <body>
                <h2>iframe - Message Receiver</h2>
                <p>This iframe receives messages from the parent window.</p>
                <div class="message-log" id="iframeLog"></div>
                <button onclick="sendRe