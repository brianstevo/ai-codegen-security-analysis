<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Logout Example</title>
</head>
<body>
<button id="logoutBtn">Logout</button>

<script>
function logout() {
  // Clear any stored authentication data
  try {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    sessionStorage.clear();
  } catch (e) {
    console.error('Error clearing storage:', e);
  }

  // Clear auth-related cookies (if any)
  document.cookie.split(';').forEach(function (cookie) {
    var name = cookie.split('=')[0].trim();
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
  });

  // Redirect the user to the login page
  window.location.href = 'login.html';
}

document.getElementById('logoutBtn').addEventListener('click', logout);
</script>
</body>
</html>