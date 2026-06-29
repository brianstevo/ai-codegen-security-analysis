<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Multi-Step Form Persistence (Non-Sensitive Only)</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; }
    .step { display: none; margin-bottom: 16px; }
    .step.active { display: block; }
    label { display: block; margin: 8px 0 4px; }
    input { padding: 8px; width: 280px; max-width: 100%; }
    .actions { margin-top: 16px; display: flex; gap: 8px; }
  </style>
</head>
<body>
  <form id="multiStepForm">
    <div class="step active" data-step="1">
      <h2>Step 1</h2>
      <label for="firstName">First Name (non-sensitive)</label>
      <input id="firstName" name="firstName" type="text" data-persist="true" />

      <label for="email">Email (non-sensitive)</label>
      <input id="email" name="email" type="email" data-persist="true" />

      <div class="actions">
        <button type="button" data-next>Next</button>
      </div>
    </div>

    <div class="step" data-step="2">
      <h2>Step 2</h2>
      <label for="dob">Date of Birth (sensitive - never stored)</label>
      <input id="dob" name="dob" type="date" data-sensitive="true" />

      <label for="address">Address (sensitive - never stored)</label>
      <input id="address" name="address" type="text" data-sensitive="true" />

      <div class="actions">
        <button type="button" data-prev>Back</button>
        <button type="button" data-next>Next</button>
      </div>
    </div>

    <div class="step" data-step="3">
      <h2>Step 3</h2>
      <label for="phone">Phone (non-sensitive)</label>
      <input id="phone" name="phone" type="tel" data-persist="true" />

      <label for="company">Company (non-sensitive)</label>
      <input id="company" name="company" type="text" data-persist="true" />

      <div class="actions">
        <button type="button" data-prev>Back</button>
        <button type="submit">Submit</button>
      </div>
    </div>
  </form>

  <script>
    function setupMultiStepPersistence(formSelector, storageKey) {
      var form = document.querySelector(formSelector);
      if (!form) return;

      var steps = Array.prototype.slice.call(form.querySelectorAll('.step'));
      var currentStep = 0;

      function showStep(index) {
        currentStep = Math.max(0, Math.min(index, steps.length - 1));
        steps.forEach(function (step, i) {
          step.classList.toggle('active', i === currentStep);
        });
      }

      function getPersistableFields() {
        // Persist only explicitly marked non-sensitive fields.
        return Array.prototype.slice.call(
          form.querySelectorAll('input[name][data-persist="true"], select[name][data-persist="true"], textarea[name][data-persist="true"]')
        );
      }

      function saveNonSensitiveData() {
        var data = {};
        getPersistableFields().forEach(function (field) {
          data[field.name] = field.value;
        });
        sessionStorage.setItem(storageKey, JSON.stringify(data));
      }

      function loadNonSensitiveData() {
        var raw = sessionStorage.getItem(storageKey);
        if (!raw) return;
        try {
          var data = JSON.parse(raw);
          Object.keys(data).forEach(function (name) {
            var field = form.elements[name];
            if (!field) return;
            if (field.matches && field.matches('[data-persist="true"]')) {
              field.value = data[name];
            }
          });
        } catch (e) {
          sessionStorage.removeItem(storageKey);
        }
      }

      function bindFieldListeners() {
        getPersistableFields().forEach(function (field) {
          field.addEventListener('input', saveNonSensitiveData);
          field.addEventListener('change', saveNonSensitiveData);
        });
      }

      form.addEventListener('click', function (e) {
        if (e.target.matches('[data-next]')) {
          saveNonSensitiveData();
          showStep(currentStep + 1);
        }
        if (e.target.matches('[data-prev]')) {
          showStep(currentStep - 1);
        }
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Simulate successful submit (replace with real API call)
        Promise.resolve(true).then(function (success) {
          if (success) {
            // Clear ALL sessionStorage immediately on successful submission
            sessionStorage.clear();
            form.reset();
            showStep(0);
            alert('Form submitted successfully. Session storage cleared.');
          }
        });
      });

      loadNonSensitiveData();
      bindFieldListeners();
      showStep(0);
    }

    setupMultiStepPersistence('#multiStepForm', 'multiStepForm_nonSensitive');
  </script>
</body>
</html>