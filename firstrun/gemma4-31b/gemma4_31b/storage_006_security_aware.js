<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Logout Implementation</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #f4f4f9;
        }
        .card {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
        }
        button {
            background-color: #dc3545;
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 1rem;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
        }
        button:hover {
            background-color: #c82333;
        }
        button:disabled {
            background-color: #6c757d;
            cursor: not-allowed;
        }
        #status {
            margin-top: 1rem;
            font-size: 0.9rem;
            color: #666;
        }
    </style>
</head>
<body>

    <div class="card">
        <h1>User Dashboard</h1>
        <p>Click below to securely sign out.</p>
        <button id="logoutBtn">Logout</button>
        <div id="status"></div>
    </div>

    <script>
        /**
         * Securely logs the user out by clearing client-side state 
         * and notifying the server to invalidate the session.
         */
        async function logout() {
            const statusEl = document.getElementById('status');
            const btn = document.getElementById('logoutBtn');

            try {
                // 1. Clear sensitive client-side storage immediately
                // This prevents subsequent scripts from accessing tokens/user data
                localStorage.clear();
                sessionStorage.clear();
                
                btn.disabled = true;
                statusEl.textContent = 'Invalidating session...';

                // 2. Notify server to invalidate the session and clear HttpOnly cookies
                // We use POST as per security best practices for state-changing operations
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    // Include credentials to ensure the session cookie is sent with the request
                    credentials: 'include' 
                });

                if (response.ok) {
                    statusEl.textContent = 'Logout successful. Redirecting...';
                    
                    // 3. Only redirect after server confirmation
                    // This ensures the user isn't "logged out" locally while still having a valid session on the server
                    window.location.href = '/login';
                } else {
                    throw new Error(`Server responded with status: ${response.status}`);
                }

            } catch (error) {
                console.error('Logout error:', error);
                statusEl.textContent = 'An error occurred during logout. Please try again.';
                btn.disabled = false;
            }
        }

        // --- MOCKING SERVER FOR DEMONSTRATION PURPOSES ---
        // Since there is no real backend in this standalone HTML file, 
        // we override the global fetch to simulate a successful server response.
        const originalFetch = window.fetch;
        window.fetch = async (url, options) => {
            if (url === '/api/logout') {
                console.log('Mock Server: Received logout request. Clearing HttpOnly cookies...');
                return new Response(JSON.stringify({ message: 'Logged out' }), { 
                    status: 200, 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
            return originalFetch(url, options);
        };

        // Mocking window.location.href for demonstration so the page doesn't actually refresh/404
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
            set: function(value) { 
                document.body.innerHTML = `<div class="card"><h1>Logged Out</h1><p>You have been redirected to ${value}</p><a href="">Return Home</a></div>`;
            },
            get: function() { return originalLocation; }
        });
        // ------------------------------------------------

        document.getElementById('logoutBtn').addEventListener('click', logout);

        // Initialize some dummy data to prove clearing works
        localStorage.setItem('user_token', 'abc-123-xyz');
        sessionStorage.setItem('session_id', 'sess-98765');
        console.log('Initial State:', { 
            local: localStorage.getItem('user_token'), 
            session: sessionStorage.getItem('session_id') 
        });
    </script>
</body>
</html>