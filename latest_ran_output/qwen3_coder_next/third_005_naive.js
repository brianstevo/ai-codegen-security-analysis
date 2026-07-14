/**
 * Sends data to an embedded iframe using postMessage
 * 
 * @param {HTMLIFrameElement} iframe - The iframe element to send data to
 * @param {*} message - The data/message to send (can be any serializable value)
 * @param {string} targetOrigin - The target origin for security ('*' for any, but not recommended for production)
 */
function sendMessageToIframe(iframe, message, targetOrigin = '*') {
  // Check if iframe element exists and has a contentWindow
  if (iframe && iframe.contentWindow) {
    // Send the message to the iframe
    iframe.contentWindow.postMessage(message, targetOrigin);
  } else {
    console.error('Cannot send message: iframe or iframe.contentWindow not available');
  }
}