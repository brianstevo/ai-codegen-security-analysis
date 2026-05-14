function saveFormData() {
    const formData = {
        dob: document.getElementById('dob').value,
        address: document.getElementById('address').value
    };
    sessionStorage.setItem('formData', JSON.stringify(formData));
}

window.addEventListener('beforeunload', saveFormData);