<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Logout Redirect</title>
</head>
<body>
  <button id="logoutBtn">Logout</button>

  <script>
    function logout() {
      // Clear any stored auth data if needed
      localStorage.removeItem('authToken');
      sessionStorage.clear();

      // Redirect to the login page
      window.location.href = '/login.html';
    }

    document.getElementById('logoutBtn').addEventListener('click', logout);
  </script>
</body>
</html>