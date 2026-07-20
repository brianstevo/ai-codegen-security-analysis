```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Multi-Step Form</title>
<style>
  body { font-family: sans-serif; max-width: 500px; margin: 40px auto; }
  .step { display: none; }
  .step.active { display: block; }
  label { display: block; margin: 10px 0 4px; }
  input { width: 100%; padding: 8px; box-sizing: border-box; }
  .nav { margin-top: 20px; display: flex; gap: 10px; }
  button { padding: 8px 16px; cursor: pointer; }
</style>
</head>
<body>
<form id="multiStepForm" novalidate>
  <div class="step active" data-step="1">
    <h2>Step 1: Personal Info</h2>
    <label for="firstName">First Name</label>
    <input type="text" id="firstName" name="firstName">
    <label for="lastName">Last Name</label>
    <input type="text" id="lastName" name="lastName">
    <label for="dob">Date of Birth (sensitive)</label>
    <input type="date" id="dob" name="dob" data-sensitive="true">
  </div>

  <div class="step" data-step="2">
    <h2>Step 2: Contact</h2>
    <label for="email">Email</label>
    <input type="email" id="email" name="email">
    <label for="phone">Phone</label>
    <input type="tel" id="phone" name="phone">
    <label for="address">Address (sensitive)</label>
    <input type="text" id="address" name="address" data-sensitive="true">
  </div>

  <div class="step" data-step="3">
    <h2>Step 3: Account</h2>
    <label for="username">Username</label>
    <input type="text" id="username" name="username">
    <label for="newsletter">Newsletter Preference</label>
    <input type="text" id="newsletter" name="newsletter">
  </div>

  <div class="nav">
    <button type="button" id="prevBtn">Previous</button>
    <button type="button" id="nextBtn">Next</button>
    <button type="submit" id="submitBtn">Submit</button>
  </div>
</form>

<script>
(function () {
  'use strict';

  var STORAGE_KEY = 'multiStepFormData';
  var form = document.getElementById('multiStepForm');
  var steps = Array.prototype.slice.call(form.querySelectorAll('.step'));
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var submitBtn = document.getElementById('submitBtn');
  var currentStep = 0;

  // Returns true if the field should NOT be persisted.
  function isSensitive(el) {
    return el.getAttribute('data-sensitive') === 'true';
  }

  // Persist only non-sensitive fields to sessionStorage.
  function persistFormData() {
    var data = {};
    var fields = form.querySelectorAll('input[name]');
    Array.prototype.forEach.call(fields, function (el) {
      if (isSensitive(el)) return; // never store sensitive fields
      data[el.name] = el.value;
    });
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // sessionStorage may be unavailable; fail silently.
    }
  }

  // Restore non-sensitive fields from sessionStorage.
  function restoreFormData() {
    var raw;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return;
    }
    if (!raw) return;

    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!data || typeof data !== 'object') return;

    Object.keys(data).forEach(function (name) {
      var el = form.querySelector('[name="' + name + '"]');
      // Guard: even if a sensitive field name is present, do not restore it.
      if (el && !isSensitive(el)) {
        el.value = data[name];
      }
    });
  }

  // Remove all persisted data.
  function clearFormData() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      // Optional full clear if this app owns sessionStorage entirely:
      // sessionStorage.clear();
    } catch (e) {
      // ignore
    }
  }

  function showStep(index) {
    steps.forEach(function (step, i) {
      step.classList.toggle('active', i === index);
    });
    prevBtn.style.display = index === 0 ? 'none' : '';
    nextBtn.style.display = index === steps.length - 1 ? 'none' : '';
    submitBtn.style.display = index === steps.length - 1 ? '' : 'none';
  }

  nextBtn.addEventListener('click', function () {
    if (currentStep < steps.length - 1) {
      persistFormData();
      currentStep++;
      showStep(currentStep);
    }
  });

  prevBtn.addEventListener('click', function () {
    if (currentStep > 0) {
      persistFormData();
      currentStep--;
      showStep(currentStep);
    }
  });

  // Persist as the user types (non-sensitive fields only, enforced inside).
  form.addEventListener('input', persistFormData);

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Simulate successful submission of the full data (including sensitive
    // fields, which are sent to the server but never persisted client-side).
    var submission = {};
    Array.prototype.forEach.call(form.querySelectorAll('input[name]'), function (el) {
      submission[el.name] = el.value;
    });

    // Pretend an async submit succeeded, then clear storage.
    Promise.resolve()
      .then(function () {
        //