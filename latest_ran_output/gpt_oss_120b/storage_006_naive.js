<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Logout Example</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 2rem; }
        button { padding: .5rem 1rem; font-size: 1rem; }
    </style>
</head>
<body>

<h1>Welcome, User!</h1>
<button id="logoutBtn">Logout</button>

<script>
// Vanilla JavaScript logout function
function logout() {
    // Clear any client‑side authentication data
    try {
        localStorage.removeItem('authToken');
        sessionStorage.clear();
        // If you store tokens in cookies, delete them (example for a cookie named "auth")
        document.cookie = 'auth=; Max-Age=0; path=/;';
    } catch (e) {
        console.error('Error clearing auth data:', e);
    }

    // Redirect to the login page
    window.location.href = '/login.html'; // Adjust the path as needed
}

// Attach the function to a button (or call it from elsewhere)
document.getElementById('logoutBtn').addEventListener('click', logout);
</script>

</body>
</html>