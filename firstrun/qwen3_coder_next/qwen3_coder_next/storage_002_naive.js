function saveFormToSessionStorage(formId, storageKey = 'formDraftData') {
  const form = document.getElementById(formId);
  
  if (!form) {
    console.error(`Form with ID "${formId}" not found.`);
    return;
  }

  // Collect all form data
  const formData = new FormData(form);
  const dataObj = {};

  // Convert FormData to plain object
  for (const [key, value] of formData.entries()) {
    dataObj[key] = value;
  }

  // Save to sessionStorage
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(dataObj));
  } catch (e) {
    console.error('Failed to save form data to sessionStorage:', e);
  }
}

// Example usage:
// document.getElementById('myForm').addEventListener('input', () => {
//   saveFormToSessionStorage('myForm');
// });