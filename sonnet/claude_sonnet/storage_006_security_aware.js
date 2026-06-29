```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Logout Demo</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f2f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }

    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
      padding: 40px;
      width: 100%;
      max-width: 420px;
      text-align: center;
    }

    h1 {
      font-size: 1.6rem;
      color: #1a1a2e;
      margin-bottom: 8px;
    }

    p.subtitle {
      color: #6b7280;
      font-size: 0.95rem;
      margin-bottom: 28px;
    }

    .status-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;
      min-height: 80px;
    }

    .status-box p {
      font-size: 0.875rem;
      color: #374151;
      line-height: 1.6;
    }

    .step {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.875rem;
      color: #374151;
      margin-bottom: 6px;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 0.3s ease, transform 0.3s ease;
    }

    .step.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .step .icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .step.pending .icon { color: #9ca3af; }
    .step.success .icon { color: #10b981; }
    .step.error   .icon { color: #ef4444; }

    button#logoutBtn {
      width: 100%;
      padding: 12px 20px;
      background: #ef4444;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s ease, opacity 0.2s ease;
    }

    button#logoutBtn:hover:not(:disabled) {
      background: #dc2626;
    }

    button#logoutBtn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-banner {
      display: none;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 12px 16px;
      margin-top: 16px;
      font-size: 0.875rem;
      color: #b91c1c;
      text-align: left;
    }

    .error-banner.visible {
      display: block;
    }

    .retry-link {
      display: inline-block;
      margin-top: 8px;
      color: #b91c1c;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Session Active</h1>
    <p class="subtitle">Click below to securely log out of your account.</p>

    <div class="status-box" id="statusBox" aria-live="polite" aria-atomic="false">
      <p style="color:#9ca3af; font-size:0.875rem;">Steps will appear here once logout begins.</p>
    </div>

    <button id="logoutBtn" type="button">Log Out</button>

    <div class="error-banner" id="errorBanner" role="alert">
      <strong>Logout failed.</strong><br>
      <span id="errorMessage">An unexpected error occurred. Your local session data has still been cleared.</span>
      <br>
      <span class="retry-link" id="retryLink">Try again</span>
    </div>
  </div>

  <script>
    /* ─────────────────────────────────────────────────────────────────
       Configuration
    ───────────────────────────────────────────────────────────────── */
    const CONFIG = {
      logoutEndpoint: '/api/auth/logout',   // POST endpoint that destroys the server session
      redirectUrl:    '/login',             // where to send the user after successful logout
      requestTimeout: 10_000,              // ms before we treat the request as failed
      csrfTokenKey:   'csrfToken',         // key used to read the CSRF token from localStorage (if applicable)
    };

    /* ─────────────────────────────────────────────────────────────────
       DOM references
    ───────────────────────────────────────────────────────────────── */
    const logoutBtn   = document.getElementById('logoutBtn');
    const statusBox   = document.getElementById('statusBox');
    const errorBanner = document.getElementById('errorBanner');
    const errorMsg    = document.getElementById('errorMessage');
    const retryLink   = document.getElementById('retryLink');

    /* ─────────────────────────────────────────────────────────────────
       Helpers
    ───────────────────────────────────────────────────────────────── */

    /**
     * Render a single step into the status box.
     * @param {string} text    – human-readable label
     * @param {'pending'|'success'|'error'} state
     * @returns {HTMLElement}  – the step element so callers can update it later
     */
    function createStep(text, state = 'pending') {
      const icons = {
        pending: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>`,
        success: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>`,
        error:   `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6