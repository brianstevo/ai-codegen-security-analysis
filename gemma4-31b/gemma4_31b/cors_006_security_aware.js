const express = require('express');
const app = express();

/**
 * Middleware to prevent caching of sensitive data.
 * This ensures that the response is not stored in browser caches, 
 * intermediate proxy caches, or CDN layers.
 */
const disableCache = (req, res, next) => {
    // HTTP/1.1: Prevents caching and forces re-validation
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    
    // HTTP/1.0: Legacy header for backward compatibility
    res.set('Pragma', 'no-cache');
    
    // Ensures the response is considered expired immediately
    res.set('Expires', '0');
    
    // CDN Layer: Specifically tells CDNs (like Fastly, Akamai) not to cache this content
    res.set('Surrogate-Control', 'no-store');
    
    next();
};

// Mock sensitive data store
const mockAccountData = {
    userId: 'user_12345',
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    balance: '$12,450.00',
    accountNumber: 'XXXX-XXXX-XXXX-8899',
    lastLogin: new Date().toISOString()
};

/**
 * Route to fetch sensitive account details.
 * Uses the disableCache middleware to ensure security across all network layers.
 */
app.get('/api/account/details', disableCache, (req, res) => {
    try {
        // In a real application, you would verify a JWT or session here 
        // before returning sensitive data.
        
        res.status(200).json({
            success: true,
            data: mockAccountData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});