function sendDataToIframe(iframeSelectorOrElement, data, targetOrigin) {
  var iframe =
    typeof iframeSelectorOrElement === "string"
      ? document.querySelector(iframeSelectorOrElement)
      : iframeSelectorOrElement;

  if (!iframe || iframe.tagName !== "IFRAME") {
    throw new Error("A valid iframe element or selector is required.");
  }

  if (!iframe.contentWindow) {
    throw new Error("The iframe window is not available.");
  }

  iframe.contentWindow.postMessage(data, targetOrigin || "*");
}

// Example usage:
// sendDataToIframe("#myIframe", { type: "USER_DATA", name: "Alice" }, "https://example.com");