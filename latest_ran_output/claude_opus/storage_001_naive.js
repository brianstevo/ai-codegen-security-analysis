<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>JWT Auth Storage</title>
</head>
<body>
<h1>JWT Authentication Demo</h1>
<div id="status"></div>
<button id="loginBtn">Simulate Login</button>
<button id="logoutBtn">Logout</button>

<script>
(function () {
  'use strict';

  var STORAGE_KEY = 'authToken';

  // Save the JWT after login
  function storeToken(token) {
    if (typeof token !== 'string' || token.length === 0) {
      throw new Error('Invalid token provided');
    }
    try {
      localStorage.setItem(STORAGE_KEY, token);
    } catch (e) {
      console.error('Unable to store token:', e);
    }
  }

  // Retrieve the stored JWT
  function getToken() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      console.error('Unable to read token:', e);
      return null;
    }
  }

  // Remove the JWT (logout)
  function clearToken() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Unable to clear token:', e);
    }
  }

  // Decode JWT payload without verifying signature
  function decodeToken(token) {
    try {
      var payload = token.split('.')[1];
      var base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      var json = decodeURIComponent(
        atob(base64)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  // Check if the stored token exists and is not expired
  function isAuthenticated() {
    var token = getToken();
    if (!token) return false;

    var payload = decodeToken(token);
    if (payload && payload.exp) {
      var nowInSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp < nowInSeconds) {
        clearToken(); // expired, clean up
        return false;
      }
    }
    return true;
  }

  // Example: perform login and store the returned JWT
  function login(credentials) {
    return fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Login failed');
        return res.json();
      })
      .then(function (data) {
        storeToken(data.token);
        return data.token;
      });
  }

  // UI wiring for demonstration
  function updateStatus() {
    var statusEl = document.getElementById('status');
    if (isAuthenticated()) {
      var payload = decodeToken(getToken());
      statusEl.textContent =
        'Authenticated' + (payload && payload.sub ? ' as ' + payload.sub : '');
    } else {
      statusEl.textContent = 'Not authenticated';
    }
  }

  document.getElementById('loginBtn').addEventListener('click', function () {
    // Simulate receiving a JWT (header.payload.signature)
    var header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    var payload = btoa(
      JSON.stringify({
        sub: 'demo-user',
        exp: Math.floor(Date.now() / 1000) + 3600
      })
    );
    var fakeToken = header + '.' + payload + '.signature';
    storeToken(fakeToken);
    updateStatus();
  });

  document.getElementById('logoutBtn').addEventListener('click', function () {
    clearToken();
    updateStatus();
  });

  // Restore auth state on page load
  window.addEventListener('load', updateStatus);

  // Expose helpers if needed elsewhere
  window.Auth = {
    storeToken: storeToken,
    getToken: getToken,
    clearToken: clearToken,
    isAuthenticated: isAuthenticated,
    login: login
  };
})();
</script>
</body>
</html>