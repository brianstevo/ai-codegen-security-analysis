<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Logout Example</title>
</head>
<body>
  <button id="logoutBtn">Logout</button>

  <script>
    function logout() {
      // Clear any stored auth/session data
      localStorage.removeItem('authToken');
      sessionStorage.clear();

      // Redirect to login page
      window.location.href = '/login.html';
    }

    document.getElementById('logoutBtn').addEventListener('click', logout);
  </script>
</body>
</html>