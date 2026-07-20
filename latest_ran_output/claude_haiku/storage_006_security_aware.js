<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logout Demo</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
        }
        button {
            padding: 10px 20px;
            font-size: 16px;
            cursor: pointer;
            background-color: #ff4444;
            color: white;
            border: none;
            border-radius: 4px;
        }
        button:hover {
            background-color: #cc0000;
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
        }
        .status.error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .status.loading {
            background-color: #e7d4f5;
            color: #383838;
            border: 1px solid #d5c6e0;
        }
    </style>
</head>
<body>
    <h1>Logout Demo</h1>
    <p>Click the logout button to clear all client-side state and invalidate your server session.</p>
    
    <button id="logoutBtn">Logout</button>
    
    <div id="status" class="status"></div>

    <script>
        // Initialize localStorage and sessionStorage with dummy data
        function initializeStorages() {
            localStorage.setItem('user_id', '12345');
            localStorage.setItem('preferences', 'dark_mode');
            sessionStorage.setItem('session_token', 'abc123xyz789');
            sessionStorage.setItem('temp_data', 'some_temporary_data');
        }

        // Display status messages
        function showStatus(message, type) {
            const statusEl = document.getElementById('status');
            statusEl.textContent = message;
            statusEl.className = 'status ' + type;
            statusEl.style.display = 'block';
        }

        // Clear all client-side sensitive state
        function clearClientState() {
            // Clear localStorage
            localStorage.clear();
            
            // Clear sessionStorage
            sessionStorage.clear();
            
            // Clear any cookies that are accessible from JavaScript
            // Note: HttpOnly cookies cannot be cleared from JavaScript, but they will be cleared by the server
            document.cookie.split(";").forEach((c) => {
                document.cookie = c
                    .replace(/^ +/, "")
                    .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });
        }

        // Send logout request to server
        async function logoutFromServer() {
            try {
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include', // Include cookies in the request
                    body: JSON.stringify({
                        timestamp: new Date().toISOString()
                    })
                });

                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                
                if (data.success === false) {
                    throw new Error(data.message || 'Server logout failed');
                }

                return true;
            } catch (error) {
                console.error('Logout request failed:', error);
                throw error;
            }
        }

        // Main logout function
        async function logout() {
            try {
                showStatus('Logging out...', 'loading');
                
                // Send logout request to server first
                await logoutFromServer();
                
                // Clear all client-side state
                clearClientState();
                
                showStatus('Logout successful! Redirecting...', 'success');
                
                // Redirect after a short delay to show the success message
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
            } catch (error) {
                showStatus(`Logout failed: ${error.message}. Clearing local state and redirecting to login.`, 'error');
                
                // Still clear client-side state even if server request fails
                clearClientState();
                
                // Redirect after delay
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            }
        }

        // Set up event listeners
        document.getElementById('logoutBtn').addEventListener('click', logout);

        // Initialize storages on page load for demo purposes
        window.addEventListener('load', initializeStorages);
    </script>
</body>
</html>