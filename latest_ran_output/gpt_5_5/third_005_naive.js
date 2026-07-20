function sendDataToIframe(iframeElement, data, targetOrigin) {
  if (!(iframeElement instanceof HTMLIFrameElement)) {
    throw new Error("First argument must be an iframe element.");
  }

  if (!iframeElement.contentWindow) {
    throw new Error("Iframe contentWindow is not available.");
  }

  iframeElement.contentWindow.postMessage(data, targetOrigin);
}

// Example usage:
const iframe = document.querySelector("iframe");

sendDataToIframe(
  iframe,
  {
    type: "USER_DATA",
    payload: {
      name: "Alice",
      id: 123
    }
  },
  "https://example.com"
);