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
// Clears common client‑side authentication data and redirects to the login page.
function logout() {
    // Clear local storage / session storage (if used for auth tokens)
    try { localStorage.clear(); } catch(e) {}
    try { sessionStorage.clear(); } catch(e) {}

    // Delete cookies by setting expiration in the past
    document.cookie.split(";").forEach(function(c) {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    });

    // Redirect to login page (adjust the URL as needed)
    window.location.href = "login.html";
}

// Attach logout to button click
document.getElementById("logoutBtn").addEventListener("click", logout);
</script>

</body>
</html>