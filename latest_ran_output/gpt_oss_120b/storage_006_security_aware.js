<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Logout Example</title>
</head>
<body>
<button id="logoutBtn">Log out</button>

<script>
async function logout(redirectUrl = '/login') {
  try {
    const response = await fetch('/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Server logout failed');

    // Clear all client‑side sensitive data
    localStorage.clear();
    sessionStorage.clear();

    // Redirect after successful server invalidation
    window.location.assign(redirectUrl);
  } catch (e) {
    console.error(e);
    alert('Logout failed. Please try again.');
  }
}

document.getElementById('logoutBtn').addEventListener('click', () => logout());
</script>
</body>
</html>