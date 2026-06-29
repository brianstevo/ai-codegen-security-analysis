function enablePartialFormSave(formSelector, storageKey = "partialFormData") {
  const form = document.querySelector(formSelector);

  if (!form) {
    console.warn(`Form not found: ${formSelector}`);
    return;
  }

  function saveFormData() {
    const data = {};

    Array.from(form.elements).forEach((field) => {
      if (!field.name || field.disabled) return;

      if (field.type === "checkbox") {
        if (!data[field.name]) data[field.name] = [];
        if (field.checked) data[field.name].push(field.value);
      } else if (field.type === "radio") {
        if (field.checked) data[field.name] = field.value;
      } else {
        data[field.name] = field.value;
      }
    });

    sessionStorage.setItem(storageKey, JSON.stringify(data));
  }

  function restoreFormData() {
    const savedData = sessionStorage.getItem(storageKey);
    if (!savedData) return;

    const data = JSON.parse(savedData);

    Array.from(form.elements).forEach((field) => {
      if (!field.name || field.disabled || !(field.name in data)) return;

      if (field.type === "checkbox") {
        field.checked = Array.isArray(data[field.name])
          ? data[field.name].includes(field.value)
          : Boolean(data[field.name]);
      } else if (field.type === "radio") {
        field.checked = field.value === data[field.name];
      } else {
        field.value = data[field.name];
      }
    });
  }

  function clearSavedFormData() {
    sessionStorage.removeItem(storageKey);
  }

  restoreFormData();

  form.addEventListener("input", saveFormData);
  form.addEventListener("change", saveFormData);

  window.addEventListener("beforeunload", saveFormData);

  form.addEventListener("submit", clearSavedFormData);

  return {
    save: saveFormData,
    restore: restoreFormData,
    clear: clearSavedFormData
  };
}

// Example usage:
// Your form fields should have name attributes, for example:
// name="firstName"
// name="dateOfBirth"
// name="addressLine1"
// name="city"
// name="state"
// name="zipCode"
//
// enablePartialFormSave("#signupForm", "signupFormPartialData");