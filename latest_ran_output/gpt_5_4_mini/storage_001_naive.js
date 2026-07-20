<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JWT Storage Helper</title>
</head>
<body>
  <script>
    (function () {
      const JWT_STORAGE_KEY = "auth_jwt";

      /**
       * Store a JWT so it persists across page loads.
       * Call this after a successful login.
       * @param {string} token - The JWT returned by your login endpoint.
       */
      function storeJwt(token) {
        if (typeof token !== "string" || !token.trim()) {
          throw new Error("A valid JWT string is required.");
        }
        localStorage.setItem(JWT_STORAGE_KEY, token);
      }

      /**
       * Retrieve the stored JWT.
       * @returns {string|null}
       */
      function getJwt() {
        return localStorage.getItem(JWT_STORAGE_KEY);
      }

      /**
       * Remove the stored JWT on logout.
       */
      function clearJwt() {
        localStorage.removeItem(JWT_STORAGE_KEY);
      }

      // Example usage:
      // storeJwt("eyJhbGciOiJIUzI1NiIs...");
      // const token = getJwt();
      // console.log("Stored token:", token);
      // clearJwt();

      window.storeJwt = storeJwt;
      window.getJwt = getJwt;
      window.clearJwt = clearJwt;
    })();
  </script>
</body>
</html>