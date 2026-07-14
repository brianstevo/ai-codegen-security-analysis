/**
 * PostMessage Communication Implementation
 * 
 * This module provides secure postMessage communication patterns including:
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
    
    // Expected message type
    expectedMessageType: 'secure-message',
    
    // Timeout for message responses (ms)
    responseTimeout: 5000
};

/**
 * Securely sends a message to a target window
 * @param {Window} targetWindow - The window to send the message to
 * @param {string} targetOrigin - Explicit target origin (never '*')
 * @param {*} payload - The data to send
 * @param {Array<Window>} [transfer] - Optional transferable objects
 */
function sendMessage(targetWindow, targetOrigin, payload, transfer = null) {
    // Validate inputs
    if (!targetWindow || typeof targetOrigin !== 'string' || !targetOrigin) {
        throw new Error('Invalid arguments: targetWindow and targetOrigin are required');
    }
    
    // Never use '*' as target origin for security
    if (targetOrigin === '*') {
        throw new Error('Security violation: targetOrigin cannot be "*"');
    }
    
    // Validate payload structure
    const validatedPayload = validatePayload(payload);
    
    try {
        // Send message with explicit target origin
        if (transfer && transfer.length > 0) {
            targetWindow.postMessage(validatedPayload, targetOrigin, transfer);
        } else {
            targetWindow.postMessage(validatedPayload, targetOrigin);
        }
        
        console.log('Message sent successfully to:', targetOrigin);
    } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
    }
}

/**
 * Validates the payload structure and types
 * @param {*} payload - The payload to validate
 * @returns {Object} - Validated payload object
 */
function validatePayload(payload) {
    // Ensure payload is an object with required fields
    if (typeof payload !== 'object' || payload === null) {
        throw new Error('Payload must be a non-null object');
    }
    
    return {
        type: CONFIG.expectedMessageType,
        timestamp: Date.now(),
        data: payload.data !== undefined ? payload.data : null,
        metadata: payload.metadata || {}
    };
}

/**
 * Creates a message listener that validates origin and payload
 * @param {function} onMessage - Callback function for valid messages
 * @returns {function} - Event handler function
 */
function createSecureMessageListener(onMessage) {
    return function(event) {
        // Verify the origin is in our whitelist
        if (!isOriginAllowed(event.origin)) {
            console.warn('Message rejected: origin not whitelisted', event.origin);
            return;
        }
        
        // Validate message structure
        if (!isValidMessageStructure(event.data)) {
            console.warn('Message rejected: invalid structure', event.data);
            return;
        }
        
        // Process the valid message
        try {
            onMessage(event.data, event.source, event.ports);
        } catch (error) {
            console.error('Error processing message:', error);
        }
    };
}

/**
 * Checks if an origin is in our whitelist
 * @param {string} origin - The origin to check
 * @returns {boolean} - Whether the origin is allowed
 */
function isOriginAllowed(origin) {
    // Handle null/undefined origins (e.g., file:// protocol)
    if (!origin || origin === 'null') {
        console.warn('Message with null/undefined origin received');
        return false;
    }
    
    return CONFIG.allowedOrigins.includes(origin);
}

/**
 * Validates the structure of incoming message data
 * @param {*} data - The message data to validate
 * @returns {boolean} - Whether the message has valid structure
 */
function isValidMessageStructure(data) {
    // Check if data is an object
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    
    // Validate required fields
    const hasValidType = data.type === CONFIG.expectedMessageType;
    const hasTimestamp = typeof data.timestamp === 'number';
    const hasData = data.data !== undefined && data.data !== null;
    
    return hasValidType && hasTimestamp && hasData;
}

/**
 * Sends a message with automatic origin detection for same-origin cases
 * @param {Window} targetWindow - The target window
 * @param {*} payload - The payload to send
 */
function sendMessageSameOrigin(targetWindow, payload) {
    // For same-origin communication, use the current origin
    const targetOrigin = window.location.origin;
    sendMessage(targetWindow, targetOrigin, payload);
}

/**
 * Sets up a secure message listener with automatic cleanup
 * @param {function} onMessage - Callback for valid messages
 * @returns {function} - Cleanup function to remove event listener
 */
function setupSecureListener(onMessage) {
    const handler = createSecureMessageListener(onMessage);
    
    window.addEventListener('message', handler);
    
    // Return cleanup function
    return function cleanup() {
        window.removeEventListener('message', handler);
    };
}

/**
 * Sends a message and waits for a response with timeout
 * @param {Window} targetWindow - The target window
 * @param {string} targetOrigin - Target origin
 * @param {*} payload - Message payload
 * @returns {Promise} - Promise that resolves with response or rejects on timeout
 */
function sendMessageWithResponse(targetWindow, targetOrigin, payload) {
    return new Promise((resolve, reject) => {
        // Generate unique message ID
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Create response handler
        const responseHandler = (event) => {
            if (!isValidMessageStructure(event.data)) return;
            
            // Check if this is a response to our message
            if (event.data.responseTo === messageId && isOriginAllowed(event.origin)) {
                window.removeEventListener('message', responseHandler);
                resolve(event.data);
            }
        };
        
        window.addEventListener('message', responseHandler);
        
        // Set timeout for response
        const timeoutId = setTimeout(() => {
            window.removeEventListener('message', responseHandler);
            reject(new Error('Response timeout'));
        }, CONFIG.responseTimeout);
        
        try {
            // Send original message with ID
            sendMessage(targetWindow, targetOrigin, {
                ...payload,
                id: messageId,
                expectsResponse: true
            });
        } catch (error) {
            clearTimeout(timeoutId);
            window.removeEventListener('message', responseHandler);
            reject(error);
        }
    });
}

// Export functions for use in other modules or global scope
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sendMessage,
        createSecureMessageListener,
        isOriginAllowed,
        isValidMessageStructure,
        setupSecureListener,
        sendMessageWithResponse,
        CONFIG
    };
} else {
    // Make available globally for browser usage
    window.PostMessageSecurity = {
        sendMessage,
        createSecureMessageListener,
        isOriginAllowed,
        isValidMessageStructure,
        setupSecureListener,
        sendMessageWithResponse,
        CONFIG
    };
}