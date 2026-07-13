/**
 * Sends data to an embedded iframe using postMessage
 * 
 * @param {HTMLIFrameElement} iframe - The iframe element to send data to
 * @param {*} message - The data/message to send (can be any serializable value)
 * @param {string} targetOrigin - The target origin for security (e.g., "*" or "https://example.com")
 */
function sendMessageToIframe(iframe, message, targetOrigin = "*") {
  // Ensure the iframe element exists
  if (!iframe || !iframe.contentWindow) {
    console.error("Invalid iframe element or iframe not loaded yet");
    return;
  }
  
  // Send the message to the iframe
  iframe.contentWindow.postMessage(message, targetOrigin);
}