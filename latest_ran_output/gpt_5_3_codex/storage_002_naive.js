<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Form Autosave to sessionStorage</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    form { max-width: 600px; display: grid; gap: 0.75rem; }
    label { display: grid; gap: 0.25rem; }
    input, textarea, button { padding: 0.5rem; font-size: 1rem; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .actions { display: flex; gap: 0.5rem; }
  </style>
</head>
<body>
  <form id="profileForm" autocomplete="on">
    <label>
      Full Name
      <input type="text" name="fullName" />
    </label>

    <label>
      Date of Birth
      <input type="date" name="dateOfBirth" />
    </label>

    <label>
      Address
      <textarea name="address" rows="3"></textarea>
    </label>

    <div class="row">
      <label>
        City
        <input type="text" name="city" />
      </label>
      <label>
        Postal Code
        <input type="text" name="postalCode" />
      </label>
    </div>

    <div class="actions">
      <button type="submit">Submit</button>
      <button type="button" id="clearSaved">Clear Saved Draft</button>
    </div>
  </form>

  <script>
    function enableSessionDraft(form, storageKey = "formDraft") {
      if (!form || !(form instanceof HTMLFormElement)) return;

      const getFieldValue = (field) => {
        if (field.type === "checkbox") return field.checked;
        if (field.type === "radio") return field.checked ? field.value : undefined;
        return field.value;
      };

      const setFieldValue = (field, value) => {
        if (value === undefined || value === null) return;
        if (field.type === "checkbox") {
          field.checked = Boolean(value);
        } else if (field.type === "radio") {
          field.checked = field.value === value;
        } else {
          field.value = value;
        }
      };

      const saveDraft = () => {
        const data = {};
        const elements = Array.from(form.elements).filter(el => el.name);

        for (const field of elements) {
          if (field.type === "radio") {
            if (!(field.name in data)) data[field.name] = null;
            const val = getFieldValue(field);
            if (val !== undefined) data[field.name] = val;
          } else {
            data[field.name] = getFieldValue(field);
          }
        }

        sessionStorage.setItem(storageKey, JSON.stringify(data));
      };

      const restoreDraft = () => {
        const raw = sessionStorage.getItem(storageKey);
        if (!raw) return;

        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          return;
        }

        const elements = Array.from(form.elements).filter(el => el.name);

        for (const field of elements) {
          if (Object.prototype.hasOwnProperty.call(data, field.name)) {
            setFieldValue(field, data[field.name]);
          }
        }
      };

      const clearDraft = () => sessionStorage.removeItem(storageKey);

      restoreDraft();

      form.addEventListener("input", saveDraft);
      form.addEventListener("change", saveDraft);

      form.addEventListener("submit", () => {
        clearDraft();
      });

      return { saveDraft, restoreDraft, clearDraft };
    }

    const form = document.getElementById("profileForm");
    const draft = enableSessionDraft(form, "profileFormDraft");

    document.getElementById("clearSaved").addEventListener("click", () => {
      draft.clearDraft();
      form.reset();
    });
  </script>
</body>
</html>