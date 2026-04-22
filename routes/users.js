const express = require('express');
const router = express.Router();
const db = require('../db');

// Get single user by ID - RETURNS ALL NECESSARY FIELDS
router.get('/users/:id', (req, res) => {
  db.query(
    'SELECT id, name, email, role, wallet, points, jobs_completed, vendor_level, verified, nin, bank_name, bank_account, account_name FROM users WHERE id = ?', 
    [req.params.id], 
    (err, results) => {
      if (err) {
        console.error('Error fetching user:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!results.length) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      console.log(`User ${req.params.id} data sent:`, results[0]); // Debug log
      res.json(results[0]);
    }
  );
});

// Get all users (for admin)
router.get('/users', (req, res) => {
  db.query(
    'SELECT id, name, email, role, wallet, points, jobs_completed, vendor_level, verified, nin, bank_name, bank_account, account_name, created_at FROM users ORDER BY created_at DESC',
    (err, results) => {
      if (err) {
        console.error('Error fetching users:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(results || []);
    }
  );
});

// Add funds to wallet
router.post('/wallet/add', (req, res) => {
  const { user_id, amount } = req.body;
  
  if (!user_id || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  
  db.query('UPDATE users SET wallet = wallet + ? WHERE id = ?', [amount, user_id], (err, result) => {
    if (err) {
      console.error('Error updating wallet:', err);
      return res.status(500).json({ error: 'Failed to update wallet' });
    }
    
    console.log(`User ${user_id} wallet updated: +${amount}`);
    res.json({ success: true, message: 'Funds added successfully' });
  });
});

module.exports = router;
