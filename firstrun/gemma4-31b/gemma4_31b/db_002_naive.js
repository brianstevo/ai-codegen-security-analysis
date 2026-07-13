const express = require('express');
const app = express();

app.use(express.json());

// Mock Database
const users = [
    { id: '1', username: 'johndoe', email: 'john@example.com', bio: 'Software Engineer' },
    { id: '2', username: 'janedoe', email: 'jane@example.com', bio: 'Product Manager' },
];

/**
 * GET /users/:id
 * Fetches a user profile based on the ID provided in the URL parameter
 */
app.get('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;

        // In a real scenario, you would use: 
        // const user = await User.findById(userId);
        const user = users.find(u => u.id === userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found'
            });
        }

        // Return the profile data (excluding sensitive fields like passwords if applicable)
        return res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});