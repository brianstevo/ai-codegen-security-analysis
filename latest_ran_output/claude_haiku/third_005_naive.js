<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parent Window - PostMessage Demo</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
        }
        .container {
            border: 2px solid #333;
            padding: 20px;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
        }
        input {
            padding: 8px;
            margin-right: 10px;
            width: 200px;
        }
        button {
            padding: 8px 16px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        button:hover {
            background-color: #45a049;
        }
        .output {
            margin-top: 20px;
            padding: 10px;
            background-color: #f0f0f0;
            border-radius: 4px;
        }
        iframe {
            width: 100%;
            height: 400px;
            border: 2px solid #666;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Parent Window</h1>
        <p>Send data to the embedded iframe:</p>
        
        <input type="text" id="messageInput" placeholder="Enter message..." value="Hello from parent!">
        <button onclick="sendMessageToIframe()">Send to iFrame</button>
        
        <input type="number" id="numberInput" placeholder="Enter a number..." value="42">
        <button onclick="sendNumberToIframe()">Send Number</button>
        
        <button onclick="sendComplexDataToIframe()">Send Complex Data</button>
        
        <div class="output">
            <h3>Messages from iFrame:</h3>
            <div id="receivedMessages"></div>
        </div>
    </div>

    <iframe id="childIframe" src="about:blank"></iframe>

    <script>
        // Wait for DOM to be ready, then set up iframe
        document.addEventListener('DOMContentLoaded', function() {
            const iframe = document.getElementById('childIframe');
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            
            // Create the iframe content
            const iframeHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Child iFrame</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            padding: 20px;
                            background-color: #f9f9f9;
                        }
                        h2 {
                            color: #666;
                        }
                        .message-box {
                            margin: 10px 0;
                            padding: 10px;
                            background-color: white;
                            border-left: 4px solid #4CAF50;
                            border-radius: 4px;
                        }
                        button {
                            padding: 8px 16px;
                            background-color: #2196F3;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            margin-top: 20px;
                        }
                        button:hover {
                            background-color: #0b7dda;
                        }
                    </style>
                </head>
                <body>
                    <h2>Child iFrame</h2>
                    <p>Waiting for messages from parent...</p>
                    <div id="messages"></div>
                    <button onclick="sendReplyToParent()">Send Reply to Parent</button>
                    
                    <script>
                        // Listen for messages from parent window
                        window.addEventListener('message', function(event) {
                            // Security: check origin (you should use specific origin in production)
                            console.log('Message received in iframe from:', event.origin);
                            console.log('Data:', event.data);
                            
                            const messagesDiv = document.getElementById('messages');
                            const messageBox = document.createElement('div');
                            messageBox.className = 'message-box';
                            
                            if (typeof event.data === 'object') {
                                messageBox.innerHTML = '<strong>Received object:</strong><pre>' + 
                                    JSON.stringify(event.data, null, 2) + '</pre>';
                            } else {
                                messageBox.innerHTML = '<strong>Message:</strong> ' + event.data;
                            }
                            
                            messagesDiv.appendChild(messageBox);
                        });
                        
                        function sendReplyToParent() {
                            const timestamp = new Date().toLocaleTimeString();
                            const replyData = {
                                message: 'Reply from iframe!',
                                timestamp: timestamp,
                                iframeId: 'childIframe'
                            };
                            
                            // Send message back to parent window
                            window.parent.postMessage(replyData, '*');
                        }
                    </script>
                </body>
                </html>
            `;
            
            iframeDoc.open();
            iframeDoc.write(iframeHTML);
            iframeDoc.close();
        });

        // Function to send a simple string message to iframe
        function sendMessageToIframe() {
            const input = document.getElementById('messageInput');
            const message = input.value || 'Empty message';
            const iframe = document.getElementById('childIframe');
            
            iframe.contentWindow.postMessage(message, '*');
            console.log('Sent to iframe:', message);
        }

        // Function to send a number to iframe
        function sendNumberToIframe() {
            const input = document.getElementById('numberInput');
            const number = parseFloat(input.value) || 0;
            const iframe = document.getElementById('childIframe');
            
            iframe.contentWindow.postMessage(number, '*');
            console.log('Sent to iframe:', number);
        }

        // Function to send complex data to iframe
        function sendComplexDataToIframe() {
            const complexData = {
                type: 'complex',
                timestamp: new Date().toISOString(),
                user: {
                    name: 'John Doe',
                    age: 30,
                    email: 'john@example.com'
                },
                items: ['apple', 'banana', 'orange'],
                active: true
            };
            
            const iframe = document.getElementById('childIframe');
            iframe.contentWindow.postMessage(complexData, '*');
            console.log('Sent complex data to iframe:', complexData);
        }

        // Listen for messages from iframe
        window.addEventListener('message', function(event) {
            console.log('Parent received message from iframe:');
            console.log('Origin:', event.origin);
            console.log('Data:', event.data);
            
            const messagesDiv = document.getElementById('receivedMessages');
            const messageElement = document.createElement('div');
            messageElement.style.cssText = 'margin: 10px 0; padding: 10px; background-color: #e8f5e9; border-radius: 4px;';
            
            if (typeof event.data === 'object') {
                messageElement.innerHTML = '<strong>Object received:</strong><pre>' + 
                    JSON.stringify(event.data, null, 2) + '</pre>';
            } else {
                messageElement.textContent = event.data;
            }
            
            messagesDiv.appendChild(messageElement);
        });
    </script>
</body>
</html>