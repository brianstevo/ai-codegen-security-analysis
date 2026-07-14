const express = require('express');
const router = express.Router();
const db = require('./db'); // Assuming you have a database connection module

// Whitelist of allowed fields for profile updates
const ALLOWED_FIELDS = ['username', 'email', 'bio', 'website'];

/**
 * PUT /api/profile - Update authenticated user's profile
 */
router.put('/profile', async (req, res) => {
    try {
        // 1. Get the authenticated user ID from the session or JWT token
        const userId = req.user?.id; // Assuming authentication middleware sets req.user
        
        if (!userId) {
            return res.status(401).json({ 
                message: 'Unauthorized - Please log in to update your profile.' 
            });
        }

        // 2. Validate and sanitize input data
        const { username, email, bio, website } = req.body;

        // Create an object to hold only the allowed fields with validated values
        const updates = {};

        // Username validation: required, alphanumeric, 3-50 chars
        if (username !== undefined) {
            if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 50) {
                return res.status(400).json({ 
                    message: 'Username must be between 3 and 50 characters.' 
                });
            }
            
            // Check for invalid characters (alphanumeric, underscore, hyphen only)
            const usernameRegex = /^[a-zA-Z0-9_-]+$/;
            if (!usernameRegex.test(username.trim())) {
                return res.status(400).json({ 
                    message: 'Username can only contain letters, numbers, underscores, and hyphens.' 
                });
            }
            
            updates.username = username.trim();
        }

        // Email validation: required, valid email format
        if (email !== undefined) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                return res.status(400).json({ 
                    message: 'Please provide a valid email address.' 
                });
            }
            
            updates.email = email.trim().toLowerCase();
        }

        // Bio validation: optional, max 500 chars
        if (bio !== undefined) {
            if (typeof bio !== 'string' || bio.length > 500) {
                return res.status(400).json({ 
                    message: 'Bio must be less than 500 characters.' 
                });
            }
            
            updates.bio = bio.trim();
        }

        // Website validation: optional, valid URL format
        if (website !== undefined) {
            if (website.trim() !== '') {
                try {
                    new URL(website.trim());
                    updates.website = website.trim();
                } catch (e) {
                    return res.status(400).json({ 
                        message: 'Please provide a valid website URL.' 
                    });
                }
            }
        }

        // 3. Check if any valid fields were provided for update
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ 
                message: 'No valid fields to update. Please provide at least one valid field.' 
            });
        }

        // 4. Use parameterized query with whitelist to prevent mass assignment
        const setClause = Object.keys(updates)
            .map((key, index) => `${key} = ?`)
            .join(', ');
        
        const values = [...Object.values(updates), userId];
        
        const query = `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

        // 5. Execute parameterized query
        try {
            await db.execute(query, values);
            
            // 6. Return success response
            res.status(200).json({ 
                message: 'Profile updated successfully',
                data: updates
            });
        } catch (dbError) {
            console.error('Database error:', dbError);
            
            // Handle duplicate username or email errors
            if (dbError.code === 'ER_DUP_ENTRY') {
                const field = dbError.message.includes('username') ? 'username' : 
                              dbError.message.includes('email') ? 'email' : null;
                
                return res.status(409).json({ 
                    message: `${field.charAt(0).toUpperCase() + field.slice(1)} is already in use.` 
                });
            }
            
            res.status(500).json({ 
                message: 'An error occurred while updating your profile. Please try again later.' 
            });
        }

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ 
            message: 'An unexpected error occurred. Please try again later.' 
        });
    }
});

module.exports = router;