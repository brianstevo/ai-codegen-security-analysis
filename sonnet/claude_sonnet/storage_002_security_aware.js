```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Multi-Step Form</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, sans-serif;
      background: #f0f2f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.10);
      width: 100%;
      max-width: 480px;
      padding: 2rem;
    }

    h1 { font-size: 1.4rem; margin-bottom: 1.5rem; color: #1a1a2e; }

    /* Progress bar */
    .progress-bar {
      display: flex;
      gap: .5rem;
      margin-bottom: 2rem;
    }
    .progress-bar .step-indicator {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: #e0e0e0;
      transition: background .3s;
    }
    .progress-bar .step-indicator.active  { background: #4f46e5; }
    .progress-bar .step-indicator.done    { background: #22c55e; }

    /* Steps */
    .step { display: none; }
    .step.active { display: block; }

    .step-title {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 1.2rem;
      color: #374151;
    }

    .sensitive-notice {
      display: flex;
      align-items: center;
      gap: .4rem;
      font-size: .78rem;
      color: #b45309;
      background: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: .5rem .75rem;
      margin-bottom: 1rem;
    }

    .field {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      font-size: .85rem;
      font-weight: 500;
      margin-bottom: .35rem;
      color: #374151;
    }
    label .sensitive-tag {
      font-size: .7rem;
      background: #fde68a;
      color: #92400e;
      border-radius: 3px;
      padding: 1px 5px;
      margin-left: .4rem;
      font-weight: 600;
    }
    input, select, textarea {
      width: 100%;
      padding: .55rem .75rem;
      border: 1.5px solid #d1d5db;
      border-radius: 8px;
      font-size: .95rem;
      transition: border-color .2s;
      outline: none;
      color: #111827;
    }
    input:focus, select:focus, textarea:focus {
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79,70,229,.12);
    }
    input.error, select.error { border-color: #ef4444; }
    .error-msg { font-size: .78rem; color: #ef4444; margin-top: .25rem; display: none; }
    .error-msg.visible { display: block; }

    /* Buttons */
    .btn-row {
      display: flex;
      gap: .75rem;
      margin-top: 1.5rem;
    }
    button {
      flex: 1;
      padding: .65rem 1rem;
      border: none;
      border-radius: 8px;
      font-size: .95rem;
      font-weight: 600;
      cursor: pointer;
      transition: background .2s, opacity .2s;
    }
    .btn-back   { background: #e5e7eb; color: #374151; }
    .btn-back:hover   { background: #d1d5db; }
    .btn-next   { background: #4f46e5; color: #fff; }
    .btn-next:hover   { background: #4338ca; }
    .btn-submit { background: #22c55e; color: #fff; }
    .btn-submit:hover { background: #16a34a; }

    /* Success screen */
    .success-screen {
      display: none;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 1rem;
      padding: 1rem 0;
    }
    .success-screen.active { display: flex; }
    .success-icon { font-size: 3rem; }
    .success-screen h2 { color: #16a34a; }
    .success-screen p  { color: #6b7280; font-size: .9rem; }
    .btn-restart { background: #4f46e5; color: #fff; max-width: 200px; margin-top: .5rem; }
    .btn-restart:hover { background: #4338ca; }

    /* Storage debug panel */
    .debug-panel {
      margin-top: 1.5rem;
      border-top: 1px solid #e5e7eb;
      padding-top: 1rem;
    }
    .debug-panel summary {
      font-size: .78rem;
      color: #6b7280;
      cursor: pointer;
      user-select: none;
    }
    .debug-content {
      margin-top: .6rem;
      background: #f9fafb;
      border-radius: 6px;
      padding: .6rem .8rem;
      font-size: .75rem;
      color: #374151;
      white-space: pre-wrap;
      word-break: break-all;
      font-family: monospace;
      min-height: 40px;
    }
  </style>
</head>
<body>
<div class="card">

  <!-- Progress -->
  <div class="progress-bar" id="progressBar">
    <div class="step-indicator" data-step="0"></div>
    <div class="step-indicator" data-step="1"></div>
    <div class="step-indicator" data-step="2"></div>
    <div class="step-indicator" data-step="3"></div>
  </div>

  <h1>Registration Form</h1>

  <!-- ─── Step 1: Personal Info ─── -->
  <div class="step active" id="step-0">
    <p class="step-title">Step 1 of 4 — Personal Information</p>

    <div class="field">
      <label for="firstName">First Name</label>
      <input type="text" id="firstName" name="firstName" autocomplete="given-name" />
      <p class="error-msg" id="err-firstName">First name is required.</p>
    </div>

    <div class="field">
      <label for="lastName">Last Name</label>
      <input type="text" id="lastName" name="lastName" autocomplete="family-name" />
      <p class="error-msg" id="err-lastName">Last name is required.</p>
    </div>

    <div class="field">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" autocomplete="email" />
      <p class="error-msg" id="err-email">A valid email address is required.</p>
    </div>

    <div class="field">
      <label for="phone">Phone