function handleLogout() {
    // Perform any necessary cleanup (e.g., clearing session data)
    localStorage.removeItem('authToken');
    sessionStorage.clear();
    
    // Redirect to the login page
    window.location.href = '/login';
}