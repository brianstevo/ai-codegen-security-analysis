function logout() {
    // Clear any authentication tokens or session data
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('sessionId');
    
    // Redirect to login page
    window.location.href = '/login.html';
}