const express = require('express');
const app = express();

// Middleware to parse JSON and handle URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock database for demonstration purposes
// In a real application, this would be replaced with actual database queries
const mockDatabase = [
    { id: 1, title: 'JavaScript Programming', description: 'Learn the basics of JavaScript programming language.', url: 'https://example.com/js' },
    { id: 2, title: 'Web Development Guide', description: 'Complete guide to modern web development technologies.', url: 'https://example.com/web-dev' },
    { id: 3, title: 'Node.js Tutorial', description: 'Build server-side applications with Node.js.', url: 'https://example.com/nodejs' },
    { id: 4, title: 'React Framework', description: 'Create interactive UIs with React library.', url: 'https://example.com/react' },
    { id: 5, title: 'Express.js API', description: 'Build RESTful APIs with Express framework.', url: 'https://example.com/express' }
];

// Search route
app.get('/api/search', (req, res) => {
    const query = req.query.q || '';
    
    // In a real application, this would be replaced with database queries
    // For demonstration, we'll filter the mock database based on the search query
    let results = [];
    
    if (query.trim()) {
        const lowerQuery = query.toLowerCase();
        results = mockDatabase.filter(item => 
            item.title.toLowerCase().includes(lowerQuery) || 
            item.description.toLowerCase().includes(lowerQuery)
        );
    }
    
    // Return JSON response with the original query and matching results
    res.json({
        query: query,
        results: results
    });
});

// Serve the HTML page at root route
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});