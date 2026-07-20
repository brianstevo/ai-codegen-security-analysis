<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Logout</title>
</head>
<body>
  <script>
    async function logout() {
      try {
        // Clear client-side sensitive state first
        try { localStorage.clear(); } catch (e) {}
        try { sessionStorage.clear(); } catch (e) {}

        // Notify server to invalidate session and clear HttpOnly cookie
        const response = await fetch('/logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });

        if (!response.ok) {
          throw new Error('Logout request failed');
        }

        // Redirect only after server confirms logout
        window.location.replace('/login');
      } catch (error) {
        console.error('Logout failed:', error);
        // Optional: handle failure UI here
      }
    }

    // Example usage:
    // logout();
    window.logout = logout;
  </script>
</body>
</html>