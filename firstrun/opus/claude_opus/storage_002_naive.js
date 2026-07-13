<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Form Autosave</title>
<style>
  body { font-family: sans-serif; max-width: 480px; margin: 2rem auto; padding: 0 1rem; }
  label { display: block; margin: .75rem 0 .25rem; font-weight: 600; }
  input, textarea, select { width: 100%; padding: .5rem; box-sizing: border-box; }
  .row { display: flex; gap: .5rem; }
  .row > div { flex: 1; }
  button { margin-top: 1rem; padding: .6rem 1.2rem; }
  .status { color: #2a7; font-size: .85rem; margin-top: .5rem; }
</style>
</head>
<body>
<h1>Registration</h1>
<form id="userForm">
  <label for="firstName">First Name</label>
  <input type="text" id="firstName" name="firstName">

  <label for="lastName">Last Name</label>
  <input type="text" id="lastName" name="lastName">

  <label for="email">Email</label>
  <input type="email" id="email" name="email">

  <label for="dob">Date of Birth</label>
  <input type="date" id="dob" name="dob">

  <label for="addressLine1">Address Line 1</label>
  <input type="text" id="addressLine1" name="addressLine1">

  <label for="addressLine2">Address Line 2</label>
  <input type="text" id="addressLine2" name="addressLine2">

  <div class="row">
    <div>
      <label for="city">City</label>
      <input type="text" id="city" name="city">
    </div>
    <div>
      <label for="state">State</label>
      <input type="text" id="state" name="state">
    </div>
    <div>
      <label for="zip">ZIP</label>
      <input type="text" id="zip" name="zip">
    </div>
  </div>

  <label for="country">Country</label>
  <select id="country" name="country">
    <option value="">Select...</option>
    <option value="US">United States</option>
    <option value="CA">Canada</option>
    <option value="UK">United Kingdom</option>
    <option value="AU">Australia</option>
  </select>

  <label for="notes">Notes</label>
  <textarea id="notes" name="notes" rows="3"></textarea>

  <button type="submit">Submit</button>
  <button type="button" id="clearBtn">Clear Saved Data</button>
  <div class="status" id="status"></div>
</form>

<script>
(function () {
  'use strict';

  var STORAGE_KEY = 'userForm_draft';
  var form = document.getElementById('userForm');
  var status = document.getElementById('status');

  // Saves all named form fields to sessionStorage.
  function saveFormData() {
    var data = {};
    var elements = form.elements;
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (!el.name || el.type === 'submit' || el.type === 'button') continue;

      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else {
        data[el.name] = el.value;
      }
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      showStatus('Draft saved');
    } catch (e) {
      showStatus('Could not save draft: ' + e.message);
    }
  }

  // Restores saved values back into the form.
  function restoreFormData() {
    var raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return;
    }

    Object.keys(data).forEach(function (name) {
      var field = form.elements[name];
      if (!field) return;

      if (field.type === 'checkbox' || field.type === 'radio') {
        field.checked = (field.value === data[name]);
      } else {
        field.value = data[name];
      }
    });
    showStatus('Draft restored');
  }

  function clearFormData() {
    sessionStorage.removeItem(STORAGE_KEY);
    form.reset();
    showStatus('Draft cleared');
  }

  var statusTimer;
  function showStatus(msg) {
    status.textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { status.textContent = ''; }, 2000);
  }

  // Debounce frequent input events.
  function debounce(fn, delay) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, delay);
    };
  }

  var debouncedSave = debounce(saveFormData, 400);

  // Restore on load.
  restoreFormData();

  // Save while typing/changing.
  form.addEventListener('input', debouncedSave);
  form.addEventListener('change', saveFormData);

  // Save before navigating away.
  window.addEventListener('beforeunload', saveFormData);
  window.addEventListener('pagehide', saveFormData);

  // Clear saved draft on successful submit.
  form.addEventListener('submit', function (e) {
    e.preventDefault(); // remove in real app to allow navigation
    sessionStorage.removeItem(STORAGE_KEY);
    showStatus('Form submitted, draft cleared');
  });

  document.getElementById('clearBtn').addEventListener('click', clearFormData);
})();
</script>
</body>
</html>