const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
app.use(cookieParser());

app.post('/logout', (req, res) => {
  // Invalidate server-side session
  req.session.destroy();

  // Clear all cookies by setting Max-Age to 0
  res.clearCookie('session');

  // Clear localStorage and sessionStorage on the client side
  res.send(`
    <script>
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    </script>
  `);

  // Set Cache-Control: no-store in the redirect response
  res.setHeader('Cache-Control', 'no-store');
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});