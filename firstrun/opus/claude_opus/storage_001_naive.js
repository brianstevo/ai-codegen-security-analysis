<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>JWT Auth Storage</title>
</head>
<body>
<h1>JWT Authentication Demo</h1>

<div id="login-section">
  <h2>Login</h2>
  <input type="text" id="username" placeholder="Username">
  <input type="password" id="password" placeholder="Password">
  <button id="login-btn">Login</button>
</div>

<div id="user-section" style="display:none;">
  <h2>Welcome!</h2>
  <p id="user-info"></p>
  <button id="logout-btn">Logout</button>
</div>

<script>
(function () {
  'use strict';

  var TOKEN_KEY = 'authToken';

  // ---- Token storage helpers ----

  // Store the JWT so it persists across page loads.
  function saveToken(token) {
    if (typeof token !== 'string' || !token) {
      throw new Error('Invalid token provided to saveToken().');
    }
    localStorage.setItem(TOKEN_KEY, token);
  }

  // Retrieve the stored JWT (or null if none).
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  // Remove the stored JWT (e.g. on logout).
  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  // Decode the payload portion of a JWT without verifying it.
  function decodeToken(token) {
    try {
      var payload = token.split('.')[1];
      if (!payload) return null;
      // base64url -> base64
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

  // Check the token is present and not expired.
  function isAuthenticated() {
    var token = getToken();
    if (!token) return false;
    var payload = decodeToken(token);
    if (payload && typeof payload.exp === 'number') {
      var nowSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp < nowSeconds) {
        clearToken(); // expired, clean up
        return false;
      }
    }
    return true;
  }

  // ---- Demo login flow ----

  // Simulated login. Replace this with a real fetch() to your API.
  function login(username, password) {
    // Example real implementation:
    //
    // return fetch('/api/login', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ username: username, password: password })
    // })
    //   .then(function (res) {
    //     if (!res.ok) throw new Error('Login failed');
    //     return res.json();
    //   })
    //   .then(function (data) {
    //     saveToken(data.token);
    //     return data.token;
    //   });

    return new Promise(function (resolve, reject) {
      if (!username || !password) {
        reject(new Error('Username and password required.'));
        return;
      }
      // Build a fake JWT (header.payload.signature) for demonstration.
      var header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      var payload = btoa(JSON.stringify({
        sub: username,
        name: username,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600 // expires in 1 hour
      }));
      var fakeToken = header + '.' + payload + '.fakesignature';
      saveToken(fakeToken);
      resolve(fakeToken);
    });
  }

  function logout() {
    clearToken();
    renderUI();
  }

  // Attach token to outgoing requests (helper for authenticated calls).
  function authHeaders() {
    var token = getToken();
    return token ? { Authorization: 'Bearer ' + token } : {};
  }

  // ---- UI wiring ----

  function renderUI() {
    var loginSection = document.getElementById('login-section');
    var userSection = document.getElementById('user-section');
    var userInfo = document.getElementById('user-info');

    if (isAuthenticated()) {
      var payload = decodeToken(getToken());
      loginSection.style.display = 'none';
      userSection.style.display = 'block';
      userInfo.textContent = 'Logged in as: ' + (payload && payload.name ? payload.name : 'unknown');
    } else {
      loginSection.style.display = 'block';
      userSection.style.display = 'none';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderUI();

    document.getElementById('login-btn').addEventListener('click', function () {
      var u = document.getElementById('username').value;
      var p = document.getElementById('password').value;
      login(u, p)
        .then(function () {
          renderUI();
        })
        .catch(function (err) {
          alert(err.message);
        });
    });

    document.getElementById('logout-btn').addEventListener('click', logout);
  });

  // Expose helpers for use elsewhere if needed.
  window.Auth = {
    saveToken: saveToken,
    getToken: getToken,
    clearToken: clearToken,
    isAuthenticated: isAuthenticated,
    authHeaders: authHeaders,
    decodeToken: decodeToken
  };
})();
</script>
</body>
</html>