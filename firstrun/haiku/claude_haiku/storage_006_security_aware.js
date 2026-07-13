```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logout Example</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
        }
        .container {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            background-color: #f9f9f9;
        }
        button {
            background-color: #dc3545;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover {
            background-color: #c82333;
        }
        button:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
        .status {
            margin-top: 20px;
            padding: 10px;
            border-radius: 4px;
            display: none;
        }
        .status.success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
            display: block;
        }
        .status.error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
            display: block;
        }
        .status.loading {
            background-color: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
            display: block;
        }
        #storageInfo {
            margin: 20px 0;
            padding: 10px;
            background-color: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: monospace;
            font-size: 14px;
        }
        .info-item {
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Logout Example</h1>
        <p>This demonstrates a secure logout flow that:</p>
        <ul>
            <li>Clears localStorage and sessionStorage</li>
            <li>Sends a POST request to invalidate the server session</li>
            <li>Clears the HttpOnly cookie (server-side)</li>
            <li>Redirects only after server confirms logout</li>
        </ul>

        <h2>Current Storage State</h2>
        <div id="storageInfo">
            <div class="info-item">Loading storage info...</div>
        </div>

        <button id="setStorageBtn">Set Test Data</button>
        <button id="logoutBtn" disabled>Logout</button>

        <div id="status"></div>
    </div>

    <script>
        // Mock logout endpoint - in production, this would be your actual backend
        const LOGOUT_ENDPOINT = '/api/logout';
        const LOGIN_PAGE = '/login';

        // Function to update the storage display
        function updateStorageDisplay() {
            const storageInfo = document.getElementById('storageInfo');
            const localStorageItems = Object.keys(localStorage);
            const sessionStorageItems = Object.keys(sessionStorage);

            let html = '<strong>LocalStorage:</strong> ';
            if (localStorageItems.length === 0) {
                html += '<em>empty</em>';
            } else {
                html += localStorageItems.map(key => `${key}="${localStorage.getItem(key)}"`).join(', ');
            }

            html += '<br><strong>SessionStorage:</strong> ';
            if (sessionStorageItems.length === 0) {
                html += '<em>empty</em>';
            } else {
                html += sessionStorageItems.map(key => `${key}="${sessionStorage.getItem(key)}"`).join(', ');
            }

            storageInfo.innerHTML = html;
        }

        // Function to show status messages
        function showStatus(message, type) {
            const statusDiv = document.getElementById('status');
            statusDiv.textContent = message;
            statusDiv.className = `status ${type}`;

            // Auto-hide success message after 3 seconds (if not redirecting)
            if (type === 'success' && !message.includes('Redirecting')) {
                setTimeout(() => {
                    statusDiv.className = 'status';
                    statusDiv.textContent = '';
                }, 3000);
            }
        }

        // Main logout function
        async function logout() {
            const logoutBtn = document.getElementById('logoutBtn');
            logoutBtn.disabled = true;

            try {
                showStatus('Logging out... Clearing local storage and notifying server...', 'loading');

                // Clear client-side storage first
                localStorage.clear();
                sessionStorage.clear();
                updateStorageDisplay();

                // Send logout request to server
                const response = await fetch(LOGOUT_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include', // Include cookies in the request
                    body: JSON.stringify({
                        timestamp: new Date().toISOString(),
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Server returned status ${response.status}`);
                }

                const data = await response.json();

                if (data.success || response.status === 200) {
                    showStatus('Logout successful! Redirecting to login page...', 'success');

                    // Redirect to login page after a short delay
                    setTimeout(() => {
                        // For this demo, we'll show a message instead of redirecting
                        // In production, use: window.location.href = LOGIN_PAGE;
                        showStatus('✓ Session invalidated and redirected to login page (demo mode)', 'success');
                    }, 500);
                } else {
                    throw new Error(data.message || 'Logout failed');
                }
            } catch (error) {
                console.error('Logout error:', error);
                showStatus(`Error during logout: ${error.message}. Please try again.`, 'error');
                logoutBtn.disabled = false;
                updateStorageDisplay();
            }
        }

        // Set test data for demonstration
        function setTestData() {
            localStorage.setItem('user_id', '12345');
            localStorage.setItem('auth_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
            sessionStorage.setItem('session_id', 'sess_abc123def456');
            sessionStorage.setItem('csrf_token', 'csrf_xyz789');

            updateStorageDisplay();
            document.getElementById('logoutBtn').disabled = false;
            showStatus('Test data added to storage', 'success');
        }

        // Event listeners
        document.getElementById('logoutBtn').addEventListener('click', logout);
        document.getElementById('setStorageBtn').addEventListener('click', setTestData);

        // Initialize display
        updateStorageDisplay();

        // Simulate a mock server endpoint for this demo
        // In a real application, this would be handled by your backend
        if (typeof window !== 'undefined' && !window.mockServerEndpointAdded) {
            window.mockServerEndpointAdded = true;

            // Intercept fetch for the logout endpoint
            const originalFetch = window.fetch;
            window.fetch = function (...args) {
                const [resource] = args;

                if (typeof resource === 'string' && resource.includes('/api/logout')) {
                    // Simulate server logout endpoint
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({