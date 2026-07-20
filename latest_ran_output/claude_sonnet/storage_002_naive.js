```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Form Auto-Save to sessionStorage</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, sans-serif;
      background: #f0f4f8;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      padding: 2rem 1rem;
    }

    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.1);
      padding: 2rem;
      width: 100%;
      max-width: 540px;
    }

    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.25rem;
      color: #1a202c;
    }

    .subtitle {
      font-size: 0.875rem;
      color: #718096;
      margin-bottom: 1.75rem;
    }

    .form-group {
      margin-bottom: 1.25rem;
    }

    label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      color: #4a5568;
      margin-bottom: 0.4rem;
    }

    input, select, textarea {
      width: 100%;
      padding: 0.6rem 0.85rem;
      border: 1.5px solid #cbd5e0;
      border-radius: 8px;
      font-size: 0.95rem;
      color: #2d3748;
      transition: border-color .2s, box-shadow .2s;
      background: #fff;
    }

    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102,126,234,.2);
    }

    textarea { resize: vertical; min-height: 80px; }

    .row { display: flex; gap: 1rem; }
    .row .form-group { flex: 1; }

    .status-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: #718096;
      margin-bottom: 1.25rem;
      min-height: 1.25rem;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #cbd5e0;
      transition: background .3s;
      flex-shrink: 0;
    }

    .status-dot.saved   { background: #48bb78; }
    .status-dot.saving  { background: #ed8936; }
    .status-dot.cleared { background: #fc8181; }

    .btn-group { display: flex; gap: 0.75rem; margin-top: 1.5rem; }

    button {
      padding: 0.65rem 1.4rem;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity .2s, transform .1s;
    }

    button:active { transform: scale(0.97); }

    .btn-primary { background: #667eea; color: #fff; flex: 1; }
    .btn-primary:hover { opacity: .9; }

    .btn-danger { background: #fed7d7; color: #c53030; }
    .btn-danger:hover { background: #feb2b2; }

    .btn-secondary { background: #e2e8f0; color: #4a5568; }
    .btn-secondary:hover { background: #cbd5e0; }

    .restore-banner {
      display: none;
      background: #ebf8ff;
      border: 1px solid #bee3f8;
      color: #2b6cb0;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      font-size: 0.875rem;
      margin-bottom: 1.25rem;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .restore-banner.visible { display: flex; }

    .restore-banner button {
      padding: 0.35rem 0.85rem;
      font-size: 0.8rem;
      background: #2b6cb0;
      color: #fff;
      border-radius: 6px;
      flex-shrink: 0;
    }

    .restore-banner button:hover { background: #2c5282; }
  </style>
</head>
<body>

<div class="card">
  <h1>Registration Form</h1>
  <p class="subtitle">Your progress is automatically saved.</p>

  <div class="restore-banner" id="restoreBanner">
    <span>📋 Saved data found. Would you like to restore it?</span>
    <div style="display:flex;gap:.5rem">
      <button id="btnRestore">Restore</button>
      <button id="btnDismiss" style="background:#bee3f8;color:#2b6cb0;">Dismiss</button>
    </div>
  </div>

  <div class="status-bar">
    <span class="status-dot" id="statusDot"></span>
    <span id="statusText">No data saved yet.</span>
  </div>

  <form id="registrationForm" novalidate>

    <div class="row">
      <div class="form-group">
        <label for="firstName">First Name</label>
        <input type="text" id="firstName" name="firstName" placeholder="Jane" />
      </div>
      <div class="form-group">
        <label for="lastName">Last Name</label>
        <input type="text" id="lastName" name="lastName" placeholder="Doe" />
      </div>
    </div>

    <div class="form-group">
      <label for="email">Email Address</label>
      <input type="email" id="email" name="email" placeholder="jane@example.com" />
    </div>

    <div class="form-group">
      <label for="phone">Phone Number</label>
      <input type="tel" id="phone" name="phone" placeholder="+1 555 000 0000" />
    </div>

    <div class="form-group">
      <label for="dob">Date of Birth</label>
      <input type="date" id="dob" name="dob" />
    </div>

    <div class="form-group">
      <label for="gender">Gender</label>
      <select id="gender" name="gender">
        <option value="">— Select —</option>
        <option value="female">Female</option>
        <option value="male">Male</option>
        <option value="non-binary">Non-binary</option>
        <option value="prefer-not">Prefer not to say</option>
      </select>
    </div>

    <div class="form-group">
      <label for="street">Street Address</label>
      <input type="text" id="street" name="street" placeholder="123 Main St" />
    </div>

    <div class="row">
      <div class="form-group">
        <label for="city">City</label>
        <input type="text" id="city" name="city" placeholder="Springfield" />
      </div>
      <div class="form-group">
        <label for="state">State / Province