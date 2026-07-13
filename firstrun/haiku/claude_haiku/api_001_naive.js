import express from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware to verify admin authentication
async function verifyAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user has admin role in a custom claims or admin table
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (adminError || !adminData) {
      return res.status(403).json({ error: 'User is not an admin' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication check failed' });
  }
}

// Admin dashboard endpoint to get all users
app.get('/admin/users', verifyAdmin, async (req, res) => {
  try {
    // Get pagination parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;

    // Fetch all users with pagination
    const { data: users, error, count } = await supabase
      .from('users')
      .select('id, email, full_name, created_at, updated_at, is_active', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    // Return users with pagination metadata
    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching users' });
  }
});

// Admin dashboard endpoint to get user count statistics
app.get('/admin/stats', verifyAdmin, async (req, res) => {
  try {
    const { data: totalUsers, error: countError } = await supabase
      .from('users')
      .select('id', { count: 'exact' });

    if (countError) {
      return res.status(500).json({ error: 'Failed to fetch statistics' });
    }

    const { data: activeUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .eq('is_active', true);

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers?.length || 0,
        activeUsers: activeUsers?.length || 0,
        inactiveUsers: (totalUsers?.length || 0) - (activeUsers?.length || 0)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching statistics' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Admin dashboard server running on port ${PORT}`);
});