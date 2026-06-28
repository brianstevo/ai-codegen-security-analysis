/**
 * PostMessage Communication Implementation
 * 
 * This module provides secure postMessage utilities including:
 * - Sending messages with explicit target origins
 * - Receiving and validating messages from whitelisted origins
 * - Payload structure validation
 */

// Configuration
const CONFIG = {
  // Whitelist of allowed origins for receiving messages
  allowedOrigins: [
    'https://example.com',
    'https://sub.example.com',
    'https://trusted-partner.com'
  ],
  
  // Expected message structure
  expectedMessageStructure: {
    type: 'string',      // Message type identifier
    data: 'object',      // Actual payload data
    timestamp: 'number'  // Unix timestamp
  }
};

/**
 * Securely sends a message to a target window with explicit origin
 * @param {Window} targetWindow - The window to send the message to
 * @param {string} targetOrigin - The explicit target origin (e.g., 'https://example.com')
 * @param {*} payload - The data to send
 * @param {string} messageType - Type of message being sent
 */
function sendMessage(targetWindow, targetOrigin, payload, messageType) {
  if (!targetWindow) {
    throw new Error('Target window is required');
  }
  
  if (!targetOrigin || typeof targetOrigin !== 'string') {
    throw new Error('Target origin must be a non-empty string');
  }
  
  // Validate payload structure
  const message = {
    type: messageType,
    data: payload,
    timestamp: Date.now()
  };
  
  // Send the message with explicit target origin
  try {
    targetWindow.postMessage(message, targetOrigin);
  } catch (error) {
    console.error('Failed to send message:', error);
    throw error;
  }
}

/**
 * Validates the origin of an incoming message against the whitelist
 * @param {string} origin - The origin to validate
 * @returns {boolean} Whether the origin is allowed
 */
function isValidOrigin(origin) {
  return CONFIG.allowedOrigins.includes(origin);
}

/**
 * Validates the structure and types of a received message payload
 * @param {*} message - The received message object
 * @returns {{valid: boolean, error?: string}} Validation result
 */
function validateMessageStructure(message) {
  if (!message || typeof message !== 'object') {
    return { valid: false, error: 'Message must be an object' };
  }
  
  // Check required fields
  const requiredFields = ['type', 'data', 'timestamp'];
  for (const field of requiredFields) {
    if (!(field in message)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }
  
  // Validate types
  if (typeof message.type !== 'string') {
    return { valid: false, error: 'Message type must be a string' };
  }
  
  if (typeof message.data !== 'object' || message.data === null) {
    return { valid: false, error: 'Message data must be an object' };
  }
  
  if (typeof message.timestamp !== 'number') {
    return { valid: false, error: 'Message timestamp must be a number' };
  }
  
  // Validate timestamp is recent (within last 5 minutes to prevent replay attacks)
  const timeDiff = Date.now() - message.timestamp;
  if (timeDiff < 0 || timeDiff > 5 * 60 * 1000) {
    return { valid: false, error: 'Message timestamp is invalid or too old' };
  }
  
  return { valid: true };
}

/**
 * Sets up a secure message listener that validates incoming messages
 * @param {function} onValidMessage - Callback for valid messages
 * @returns {function} Function to remove the event listener
 */
function setupSecureMessageListener(onValidMessage) {
  const handleMessage = (event) => {
    // Verify origin against whitelist
    if (!isValidOrigin(event.origin)) {
      console.warn(`Blocked message from unauthorized origin: ${event.origin}`);
      return;
    }
    
    // Validate message structure
    const validation = validateMessageStructure(event.data);
    if (!validation.valid) {
      console.error('Invalid message structure:', validation.error, event.data);
      return;
    }
    
    // Process the valid message
    try {
      onValidMessage(event.data);
    } catch (error) {
      console.error('Error processing message:', error);
    }
  };
  
  window.addEventListener('message', handleMessage);
  
  // Return function to remove listener
  return () => {
    window.removeEventListener('message', handleMessage);
  };
}

/**
 * Example usage and demonstration
 */
function demonstrateSecurePostMessage() {
  console.log('=== Secure PostMessage Implementation ===');
  
  // Example 1: Sending a message securely
  try {
    const targetWindow = window.open('https://example.com/child.html', '_blank');
    if (targetWindow) {
      sendMessage(
        targetWindow, 
        'https://example.com', 
        { userId: 123, action: 'authenticate' }, 
        'AUTH_REQUEST'
      );
      console.log('Message sent successfully');
    }
  } catch (error) {
    console.error('Failed to send message:', error);
  }
  
  // Example 2: Receiving messages securely
  const removeListener = setupSecureMessageListener((message) => {
    console.log('Received valid message:', message);
    
    // Process the message based on type
    switch (message.type) {
      case 'AUTH_RESPONSE':
        handleAuthResponse(message.data);
        break;
      case 'DATA_UPDATE':
        processDataUpdate(message.data);
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  });
  
  // Helper functions for processing messages
  function handleAuthResponse(data) {
    console.log('Handling auth response:', data);
    if (data.success) {
      console.log('Authentication successful');
    } else {
      console.error('Authentication failed:', data.error);
    }
  }
  
  function processDataUpdate(data) {
    console.log('Processing data update:', data);
    // Process the data update logic here
  }
  
  // Demonstrate cleanup
  setTimeout(() => {
    removeListener();
    console.log('Message listener removed');
  }, 30000);
}

// Export functions for use in other modules or testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sendMessage,
    setupSecureMessageListener,
    isValidOrigin,
    validateMessageStructure,
    CONFIG
  };
}

// Run demonstration if executed directly
if (window.location.protocol === 'file:' || window.location.hostname === 'localhost') {
  // Only run demo in safe contexts
  console.log('Run demonstrateSecurePostMessage() to see the implementation in action');
}