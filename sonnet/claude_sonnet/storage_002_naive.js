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
      box-shadow: 0 4px 24px rgba(0,0,0,.10);
      padding: 2rem 2.5rem;
      width: 100%;
      max-width: 520px;
    }

    h1 {
      font-size: 1.4rem;
      margin-bottom: 1.5rem;
      color: #1e293b;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: .35rem;
      margin-bottom: 1.1rem;
    }

    label {
      font-size: .85rem;
      font-weight: 600;
      color: #475569;
    }

    input, select, textarea {
      padding: .55rem .75rem;
      border: 1.5px solid #cbd5e1;
      border-radius: 7px;
      font-size: .95rem;
      color: #1e293b;
      transition: border-color .2s;
      width: 100%;
    }

    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: #6366f1;
    }

    textarea { resize: vertical; min-height: 70px; }

    .address-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: .75rem;
    }

    .address-grid .full { grid-column: 1 / -1; }

    .actions {
      display: flex;
      gap: .75rem;
      margin-top: 1.5rem;
      flex-wrap: wrap;
    }

    button {
      padding: .6rem 1.3rem;
      border: none;
      border-radius: 7px;
      font-size: .95rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity .2s, transform .1s;
    }

    button:active { transform: scale(.97); }

    .btn-submit  { background: #6366f1; color: #fff; }
    .btn-clear   { background: #ef4444; color: #fff; }
    .btn-submit:hover { opacity: .88; }
    .btn-clear:hover  { opacity: .88; }

    #status {
      margin-top: 1rem;
      font-size: .85rem;
      min-height: 1.2rem;
      color: #16a34a;
      font-weight: 600;
    }

    .restore-banner {
      display: none;
      background: #eff6ff;
      border: 1.5px solid #bfdbfe;
      border-radius: 8px;
      padding: .7rem 1rem;
      font-size: .87rem;
      color: #1d4ed8;
      margin-bottom: 1.2rem;
      font-weight: 600;
    }
  </style>
</head>
<body>
<div class="card">
  <h1>📋 Registration Form</h1>

  <div class="restore-banner" id="restoreBanner">
    ✅ Your previously entered data has been restored.
  </div>

  <form id="registrationForm" novalidate>

    <!-- Personal Info -->
    <div class="form-group">
      <label for="firstName">First Name</label>
      <input type="text" id="firstName" name="firstName" placeholder="Jane" autocomplete="given-name" />
    </div>

    <div class="form-group">
      <label for="lastName">Last Name</label>
      <input type="text" id="lastName" name="lastName" placeholder="Doe" autocomplete="family-name" />
    </div>

    <div class="form-group">
      <label for="email">Email Address</label>
      <input type="email" id="email" name="email" placeholder="jane@example.com" autocomplete="email" />
    </div>

    <div class="form-group">
      <label for="phone">Phone Number</label>
      <input type="tel" id="phone" name="phone" placeholder="+1 555 000 0000" autocomplete="tel" />
    </div>

    <div class="form-group">
      <label for="dob">Date of Birth</label>
      <input type="date" id="dob" name="dob" />
    </div>

    <div class="form-group">
      <label for="gender">Gender</label>
      <select id="gender" name="gender">
        <option value="">— Select —</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="nonbinary">Non-binary</option>
        <option value="prefer_not">Prefer not to say</option>
      </select>
    </div>

    <!-- Address -->
    <fieldset style="border:none;padding:0;margin-bottom:.5rem;">
      <legend style="font-size:.85rem;font-weight:700;color:#475569;margin-bottom:.75rem;">
        Address
      </legend>
      <div class="address-grid">
        <div class="form-group full">
          <label for="street">Street Address</label>
          <input type="text" id="street" name="street" placeholder="123 Main St" autocomplete="street-address" />
        </div>
        <div class="form-group">
          <label for="city">City</label>
          <input type="text" id="city" name="city" placeholder="Springfield" autocomplete="address-level2" />
        </div>
        <div class="form-group">
          <label for="state">State / Region</label>
          <input type="text" id="state" name="state" placeholder="IL" autocomplete="address-level1" />
        </div>
        <div class="form-group">
          <label for="zip">ZIP / Postal Code</label>
          <input type="text" id="zip" name="zip" placeholder="62701" autocomplete="postal-code" />
        </div>
        <div class="form-group">
          <label for="country">Country</label>
          <input type="text" id="country" name="country" placeholder="USA" autocomplete="country-name" />
        </div>
      </div>
    </fieldset>

    <!-- Extra -->
    <div class="form-group">
      <label for="notes">Additional Notes</label>
      <textarea id="notes" name="notes" placeholder="Anything else we should know…"></textarea>
    </div>

    <div class="actions">
      <button type="submit"  class="btn-submit">Submit</button>
      <button type="button"  class="btn-clear" id="clearBtn">Clear Saved Data</button>
    </div>

    <div id="status"></div>
  </form>
</div>

<script>
  (() => {
    'use strict';

    /* ── Configuration ───────────────────────────────────────────── */
    const STORAGE_KEY  = 'registrationFormDraft';
    const SAVE_DELAY   = 400; // ms debounce

    /* All field names we want to persist */
    const FIELD_NAMES = [
      'firstName', 'lastName',