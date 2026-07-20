<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Form Auto-Save to sessionStorage</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; }
    form { max-width: 520px; display: grid; gap: 12px; }
    label { display: grid; gap: 6px; }
    input, textarea, button { padding: 8px; font-size: 14px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  </style>
</head>
<body>
  <form id="profileForm" autocomplete="on">
    <label>
      First Name
      <input type="text" name="firstName" />
    </label>

    <label>
      Last Name
      <input type="text" name="lastName" />
    </label>

    <label>
      Date of Birth
      <input type="date" name="dateOfBirth" />
    </label>

    <div class="row">
      <label>
        City
        <input type="text" name="city" />
      </label>
      <label>
        State/Province
        <input type="text" name="state" />
      </label>
    </div>

    <label>
      Address
      <textarea name="address" rows="3"></textarea>
    </label>

    <label>
      ZIP/Postal Code
      <input type="text" name="zip" />
    </label>

    <div class="row">
      <button type="submit">Submit</button>
      <button type="button" id="clearDraft">Clear Saved Draft</button>
    </div>
  </form>

  <script>
    function enableSessionFormDraft(form, storageKey) {
      if (!form || !storageKey) return;

      const fields = Array.from(form.elements).filter(el =>
        el.name && !el.disabled && !['submit', 'button', 'file', 'reset'].includes(el.type)
      );

      function readValue(el) {
        if (el.type === 'checkbox') return el.checked;
        if (el.type === 'radio') return el.checked ? el.value : null;
        return el.value;
      }

      function writeValue(el, value) {
        if (value === undefined || value === null) return;
        if (el.type === 'checkbox') {
          el.checked = Boolean(value);
        } else if (el.type === 'radio') {
          el.checked = el.value === value;
        } else {
          el.value = value;
        }
      }

      function saveDraft() {
        const data = {};
        for (const el of fields) {
          const val = readValue(el);
          if (el.type === 'radio') {
            if (val !== null) data[el.name] = val;
          } else {
            data[el.name] = val;
          }
        }
        sessionStorage.setItem(storageKey, JSON.stringify(data));
      }

      function restoreDraft() {
        const raw = sessionStorage.getItem(storageKey);
        if (!raw) return;
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        for (const el of fields) {
          if (Object.prototype.hasOwnProperty.call(data, el.name)) {
            writeValue(el, data[el.name]);
          }
        }
      }

      // Restore once on load
      restoreDraft();

      // Save on any input change
      form.addEventListener('input', saveDraft);
      form.addEventListener('change', saveDraft);

      // Optional: clear draft on successful submit
      form.addEventListener('submit', function () {
        sessionStorage.removeItem(storageKey);
      });

      return {
        save: saveDraft,
        restore: restoreDraft,
        clear: () => sessionStorage.removeItem(storageKey)
      };
    }

    const form = document.getElementById('profileForm');
    const draft = enableSessionFormDraft(form, 'profileFormDraft');

    document.getElementById('clearDraft').addEventListener('click', function () {
      draft.clear();
      form.reset();
    });
  </script>
</body>
</html>