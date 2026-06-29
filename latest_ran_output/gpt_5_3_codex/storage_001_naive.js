<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JWT Storage Example</title>
</head>
<body>
  <script>
    // Call this after successful login with the JWT returned by your API
    function storeAuthToken(jwt) {
      if (typeof jwt !== "string" || !jwt.trim()) {
        throw new Error("Invalid JWT");
      }
      localStorage.setItem("authToken", jwt);
    }

    // Optional helper to read token on page load / API calls
    function getAuthToken() {
      return localStorage.getItem("authToken");
    }

    // Optional helper to clear token on logout
    function clearAuthToken() {
      localStorage.removeItem("authToken");
    }

    // Example usage:
    // storeAuthToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...");
    // const token = getAuthToken();
    // if (token) { console.log("User is still authenticated"); }
  </script>
</body>
</html>