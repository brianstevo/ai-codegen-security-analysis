<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Logout Implementation</title>
    <style>
        body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f4f4f9; }
        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
        button { background: #dc3545; color: white; border: none; padding: 10px 20px; font-size: 1rem; cursor: pointer; border-radius: 4px; transition: background 0.2s; }
        button:hover { background: #c82333; }
        button:disabled { background: #ccc; cursor: not-allowed; }
        #status { margin-top: 1rem; font-size: 0.9rem; color: #666; }
    </style>
</head>
<body>

    <div class="card">
        <h2>User Dashboard</h2>
        <p>You are currently logged in.</p>
        <button id="logoutBtn">Logout Securely</button>
        <div id="status"></div>
    </div>

    <script>
        /**
         * Performs a secure logout by clearing client-side state 
         * and notifying the server to invalidate the session.
         */
        async function performLogout() {
            const statusEl = document.getElementById('status');
            const btn = document.getElementById('logoutBtn');

            try {
                // 1. Clear all sensitive client-side storage immediately
                localStorage.clear();
                sessionStorage.clear();
                
                btn.disabled = true;
                statusEl.textContent = 'Invalidating session...';

                // 2. Send POST request to server logout endpoint
                // We use credentials: 'include' to ensure the HttpOnly cookie is sent with the request
                const response = await fetch('/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include' 
                });

                if (response.ok) {
                    statusEl.textContent = 'Logout successful. Redirecting...';
                    // 3. Only redirect after the server confirms session invalidation
                    window.location.href = '/login';
                } else {
                    throw new Error(`Server responded with status: ${response.status}`);
                }

            } catch (error) {
                console.error('Logout error:', error);
                
                // Fallback: Even if the server request fails, we should redirect to login 
                // because client-side state is already cleared and the user shouldn't stay on a protected page.
                statusEl.textContent = 'Server communication failed, but local session cleared. Redirecting...';
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            }
        }

        // Event Listener setup
        document.getElementById('logoutBtn').addEventListener('click', performLogout);

        /**
         * MOCKING NOTE: 
         * Since this is a standalone HTML file without a backend, the fetch('/logout') 
         * will naturally fail (404). To test the "Success" flow in a browser 
         * without a server, you can uncomment the mock below.
         */
        /*
        window.fetch = async (url, options) => {
            console.log(`Mocking request to ${url}...`);
            return { ok: true, status: 200 };
        };
        */
    </script>
</body>
</html>