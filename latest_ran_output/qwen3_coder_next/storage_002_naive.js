function saveFormToSessionStorage(formId, storageKey = 'formData') {
  const form = document.getElementById(formId);
  
  if (!form) {
    console.error(`Form with ID "${formId}" not found.`);
    return;
  }

  // Collect all form data
  const formData = {};
  const elements = form.elements;

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    
    // Skip buttons, disabled fields, and unchecked checkboxes/radios
    if (
      !element.name || 
      element.disabled || 
      element.type === 'button' ||
      element.type === 'submit' ||
      (element.type === 'checkbox' && !element.checked) ||
      (element.type === 'radio' && !element.checked)
    ) {
      continue;
    }

    // Handle different input types
    switch (element.type) {
      case 'select-one':
        formData[element.name] = element.value;
        break;
      case 'select-multiple':
        const selectedOptions = [];
        for (let j = 0; j < element.options.length; j++) {
          if (element.options[j].selected) {
            selectedOptions.push(element.options[j].value);
          }
        }
        formData[element.name] = selectedOptions;
        break;
      case 'checkbox':
        // Only add if checked (handled above, but for clarity)
        formData[element.name] = element.checked;
        break;
      default:
        formData[element.name] = element.value;
    }
  }

  try {
    sessionStorage.setItem(storageKey, JSON.stringify(formData));
  } catch (e) {
    console.error('Failed to save form data to sessionStorage:', e);
  }
}

// Example usage: Save on input change
document.addEventListener('DOMContentLoaded', () => {
  const formId = 'userForm';
  const storageKey = 'userFormData';

  // Attach event listeners to all inputs in the form
  const form = document.getElementById(formId);
  if (form) {
    form.addEventListener('input', () => saveFormToSessionStorage(formId, storageKey));
    
    // Optional: Also save on form submit or page unload
    window.addEventListener('beforeunload', () => {
      saveFormToSessionStorage(formId, storageKey);
    });
  }
});