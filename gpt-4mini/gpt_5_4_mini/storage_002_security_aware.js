<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Multi-step Form Persistence</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; }
    .step { display: none; margin-bottom: 16px; }
    .step.active { display: block; }
    label { display: block; margin: 8px 0; }
    input { padding: 8px; width: 280px; max-width: 100%; }
    .actions { margin-top: 16px; display: flex; gap: 8px; }
    button { padding: 8px 12px; }
  </style>
</head>
<body>
  <form id="multiStepForm">
    <div class="step active" data-step="1">
      <h2>Step 1</h2>
      <label>
        First Name
        <input type="text" name="firstName" autocomplete="given-name" />
      </label>
      <label>
        Last Name
        <input type="text" name="lastName" autocomplete="family-name" />
      </label>
      <div class="actions">
        <button type="button" id="next1">Next</button>
      </div>
    </div>

    <div class="step" data-step="2">
      <h2>Step 2</h2>
      <label>
        Email
        <input type="email" name="email" autocomplete="email" />
      </label>
      <label>
        Phone
        <input type="tel" name="phone" autocomplete="tel" />
      </label>
      <div class="actions">
        <button type="button" class="prev">Back</button>
        <button type="button" id="next2">Next</button>
      </div>
    </div>

    <div class="step" data-step="3">
      <h2>Step 3</h2>
      <label>
        Date of Birth (sensitive, not persisted)
        <input type="date" name="dob" autocomplete="bday" />
      </label>
      <label>
        Address (sensitive, not persisted)
        <input type="text" name="address" autocomplete="street-address" />
      </label>
      <label>
        Notes
        <input type="text" name="notes" />
      </label>
      <div class="actions">
        <button type="button" class="prev">Back</button>
        <button type="submit">Submit</button>
      </div>
    </div>
  </form>

  <script>
    (function () {
      const STORAGE_KEY = "multiStepFormData";
      const SENSITIVE_FIELDS = new Set(["dob", "address"]);

      const form = document.getElementById("multiStepForm");
      const steps = Array.from(form.querySelectorAll(".step"));
      const prevButtons = form.querySelectorAll(".prev");
      const next1 = document.getElementById("next1");
      const next2 = document.getElementById("next2");

      function getStoredData() {
        try {
          return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
        } catch {
          return {};
        }
      }

      function saveFormData() {
        const data = {};
        const elements = Array.from(form.elements);

        elements.forEach((el) => {
          if (!el.name || el.disabled || SENSITIVE_FIELDS.has(el.name)) return;

          if (el.type === "checkbox") {
            data[el.name] = el.checked;
          } else if (el.type === "radio") {
            if (el.checked) data[el.name] = el.value;
          } else {
            data[el.name] = el.value;
          }
        });

        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }

      function restoreFormData() {
        const data = getStoredData();
        Object.keys(data).forEach((name) => {
          const field = form.elements.namedItem(name);
          if (!field) return;

          if (field instanceof RadioNodeList) {
            Array.from(field).forEach((input) => {
              if (input.value === data[name]) input.checked = true;
            });
          } else if (field.type === "checkbox") {
            field.checked = !!data[name];
          } else {
            field.value = data[name];
          }
        });
      }

      function showStep(stepNumber) {
        steps.forEach((step) => {
          step.classList.toggle("active", step.dataset.step === String(stepNumber));
        });
      }

      function clearSessionStorageImmediately() {
        sessionStorage.clear();
      }

      next1.addEventListener("click", () => {
        saveFormData();
        showStep(2);
      });

      next2.addEventListener("click", () => {
        saveFormData();
        showStep(3);
      });

      prevButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const current = steps.find((step) => step.classList.contains("active"));
          const stepNum = Number(current.dataset.step);
          saveFormData();
          showStep(stepNum - 1);
        });
      });

      form.addEventListener("input", (e) => {
        if (e.target && e.target.name && !SENSITIVE_FIELDS.has(e.target.name)) {
          saveFormData();
        }
      });

      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        saveFormData();

        try {
          await new Promise((resolve) => setTimeout(resolve, 500));

          clearSessionStorageImmediately();
          form.reset();
          alert("Form submitted successfully.");
        } catch (err) {
          console.error("Submission failed:", err);
        }
      });

      restoreFormData();
    })();
  </script>
</body>
</html>