<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Multi-Step Form</title>
</head>
<body>
<form id="multiStepForm">
  <fieldset>
    <legend>Personal Info</legend>
    <label>First Name: <input type="text" name="firstName"></label><br>
    <label>Last Name: <input type="text" name="lastName"></label><br>
    <label>Email: <input type="email" name="email"></label><br>
    <label>Date of Birth: <input type="date" name="dob"></label><br>
    <label>Address: <input type="text" name="address"></label><br>
    <label>City: <input type="text" name="city"></label><br>
    <label>Phone: <input type="tel" name="phone"></label><br>
  </fieldset>
  <button type="submit">Submit</button>
</form>

<script>
(function () {
  'use strict';

  var STORAGE_KEY = 'multiStepFormData';

  // Fields considered sensitive — never persisted to sessionStorage.
  var SENSITIVE_FIELDS = ['dob', 'address'];

  var form = document.getElementById('multiStepForm');

  function isSensitive(name) {
    return SENSITIVE_FIELDS.indexOf(name) !== -1;
  }

  // Collect only non-sensitive field values from the form.
  function collectNonSensitiveData() {
    var data = {};
    var elements = form.elements;
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (!el.name || !el.value) continue;
      if (el.type === 'submit' || el.type === 'button') continue;
      if (isSensitive(el.name)) continue;
      data[el.name] = el.value;
    }
    return data;
  }

  // Save non-sensitive form data to sessionStorage.
  function saveFormData() {
    try {
      var data = collectNonSensitiveData();
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // sessionStorage may be unavailable; fail silently.
    }
  }

  // Restore previously saved non-sensitive data into the form.
  function restoreFormData() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      Object.keys(data).forEach(function (name) {
        if (isSensitive(name)) return; // safety guard
        var field = form.elements[name];
        if (field && typeof data[name] === 'string') {
          field.value = data[name];
        }
      });
    } catch (e) {
      // Corrupt data — clear it.
      clearFormData();
    }
  }

  // Remove all persisted form data from sessionStorage.
  function clearFormData() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // fail silently
    }
  }

  // Persist non-sensitive data as the user types/changes inputs.
  form.addEventListener('input', saveFormData);
  form.addEventListener('change', saveFormData);

  // Restore on load.
  restoreFormData();

  // Handle submission.
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Simulate submission. Replace with real async request as needed.
    submitForm()
      .then(function () {
        // Clear ALL persisted data immediately after success.
        clearFormData();
        form.reset();
        alert('Form submitted successfully. Stored data cleared.');
      })
      .catch(function () {
        alert('Submission failed. Your non-sensitive data is still saved.');
      });
  });

  // Replace this stub with an actual fetch() to your endpoint.
  function submitForm() {
    return new Promise(function (resolve) {
      // All fields (including sensitive) are sent to the server,
      // but only at submit time — sensitive fields are never stored locally.
      var payload = {};
      var elements = form.elements;
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        if (el.name && el.type !== 'submit' && el.type !== 'button') {
          payload[el.name] = el.value;
        }
      }
      // Example real submission:
      // return fetch('/submit', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload)
      // }).then(function (res) { if (!res.ok) throw new Error(); });

      setTimeout(resolve, 300); // simulate network
    });
  }
})();
</script>
</body>
</html>