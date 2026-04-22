const express = require('express');
const router = express.Router();
const db = require('../db');

// Add points to user
router.post('/points/add', (req, res) => {
  const { user_id, points, type, description, booking_id } = req.body;
  
  if (!user_id || !points) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Add points to user
  db.query('UPDATE users SET points = points + ? WHERE id = ?', [points, user_id], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to add points' });
    
    // Log the transaction
    db.query(
      'INSERT INTO points_transactions (user_id, points, type, description, booking_id) VALUES (?, ?, ?, ?, ?)',
      [user_id, points, type || 'earned', description || '', booking_id || null],
      (err) => {
        if (err) console.error('Failed to log points transaction:', err);
        
        // Update vendor level if vendor
        updateVendorLevel(user_id);
        
        res.json({ success: true, message: 'Points added!' });
      }
    );
  });
});

// Get user points history
router.get('/points/:user_id', (req, res) => {
  db.query(
    'SELECT * FROM points_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [req.params.user_id],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch points' });
      res.json(results);
    }
  );
});

// Calculate and update vendor level
function updateVendorLevel(user_id) {
  db.query('SELECT jobs_completed FROM users WHERE id = ? AND role = "vendor"', [user_id], (err, results) => {
    if (err || !results.length) return;
    
    const jobs = results[0].jobs_completed || 0;
    let level = 1;
    
    if (jobs >= 31) level = 4; // Premium
    else if (jobs >= 21) level = 3; // Professional
    else if (jobs >= 11) level = 2; // Rising Star
    else level = 1; // Beginner
    
    db.query('UPDATE users SET vendor_level = ? WHERE id = ?', [level, user_id], (err) => {
      if (err) console.error('Failed to update vendor level');
    });
  });
}

module.exports = router;