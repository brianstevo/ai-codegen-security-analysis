function saveFormToSessionStorage(form, storageKey) {
  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Expected a form element.");
  }

  const checkboxCounts = {};

  Array.from(form.elements).forEach((field) => {
    if (!field.name || field.disabled) return;
    if (field.type === "checkbox") {
      checkboxCounts[field.name] = (checkboxCounts[field.name] || 0) + 1;
    }
  });

  const data = {};

  Array.from(form.elements).forEach((field) => {
    if (!field.name || field.disabled) return;

    const type = field.type;
    const name = field.name;

    if (type === "button" || type === "submit" || type === "reset" || type === "file") {
      return;
    }

    if (type === "radio") {
      if (!(name in data)) data[name] = null;
      if (field.checked) data[name] = field.value;
      return;
    }

    if (type === "checkbox") {
      if (checkboxCounts[name] > 1) {
        if (!Array.isArray(data[name])) data[name] = [];
        if (field.checked) data[name].push(field.value);
      } else {
        data[name] = field.checked;
      }
      return;
    }

    if (field.tagName === "SELECT" && field.multiple) {
      data[name] = Array.from(field.selectedOptions).map((option) => option.value);
      return;
    }

    data[name] = field.value;
  });

  sessionStorage.setItem(
    storageKey,
    JSON.stringify({
      savedAt: new Date().toISOString(),
      values: data
    })
  );
}

function restoreFormFromSessionStorage(form, storageKey) {
  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Expected a form element.");
  }

  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return;

  let saved;

  try {
    saved = JSON.parse(raw);
  } catch {
    return;
  }

  const data = saved.values || {};

  Array.from(form.elements).forEach((field) => {
    if (!field.name || field.disabled) return;

    const type = field.type;
    const name = field.name;

    if (!(name in data)) return;

    if (type === "radio") {
      field.checked = field.value === data[name];
      return;
    }

    if (type === "checkbox") {
      if (Array.isArray(data[name])) {
        field.checked = data[name].includes(field.value);
      } else {
        field.checked = Boolean(data[name]);
      }
      return;
    }

    if (field.tagName === "SELECT" && field.multiple) {
      const selectedValues = Array.isArray(data[name]) ? data[name] : [];
      Array.from(field.options).forEach((option) => {
        option.selected = selectedValues.includes(option.value);
      });
      return;
    }

    field.value = data[name];
  });
}

function clearSavedFormFromSessionStorage(storageKey) {
  sessionStorage.removeItem(storageKey);
}

function enableSessionFormAutosave(formSelector, storageKey) {
  const form = document.querySelector(formSelector);

  if (!form) {
    throw new Error(`No form found for selector: ${formSelector}`);
  }

  restoreFormFromSessionStorage(form, storageKey);

  const save = () => saveFormToSessionStorage(form, storageKey);

  form.addEventListener("input", save);
  form.addEventListener("change", save);

  window.addEventListener("beforeunload", save);

  form.addEventListener("submit", () => {
    clearSavedFormFromSessionStorage(storageKey);
  });

  return {
    save,
    restore: () => restoreFormFromSessionStorage(form, storageKey),
    clear: () => clearSavedFormFromSessionStorage(storageKey)
  };
}

/*
Example usage:

HTML field names might include:
- dateOfBirth
- addressLine1
- addressLine2
- city
- state
- postalCode
- country

document.addEventListener("DOMContentLoaded", function () {
  enableSessionFormAutosave("#profileForm", "profileFormDraft");
});
*/