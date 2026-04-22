const express = require('express');
const router = express.Router();
const db = require('../db');

// ===== STATS ENDPOINTS =====

// Get total users count
router.get('/admin/stats/users', (req, res) => {
  db.query('SELECT COUNT(*) as total FROM users', (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ total: results[0].total });
  });
});

// Get total bookings count
router.get('/admin/stats/bookings', (req, res) => {
  db.query('SELECT COUNT(*) as total FROM bookings', (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ total: results[0].total });
  });
});

// Get platform revenue (15% of all confirmed bookings)
router.get('/admin/stats/revenue', (req, res) => {
  db.query('SELECT SUM(amount) as total FROM bookings WHERE status = "confirmed"', (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    const totalBookings = results[0].total || 0;
    const platformRevenue = totalBookings * 0.15;
    res.json({ total: platformRevenue });
  });
});

// ===== VENDOR MANAGEMENT =====

// Get pending vendors (not verified + has submitted verification details)
router.get('/admin/vendors/pending', (req, res) => {
  db.query(
    'SELECT * FROM users WHERE role = "vendor" AND verified = 0 AND verification_submitted = 1 ORDER BY created_at DESC',
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(results || []);
    }
  );
});

// Approve vendor
router.post('/admin/vendor/:id/approve', (req, res) => {
  const vendorId = req.params.id;
  
  db.query('UPDATE users SET verified = 1 WHERE id = ? AND role = "vendor"', [vendorId], (err, result) => {
    if (err) {
      console.error('Error approving vendor:', err);
      return res.status(500).json({ error: 'Failed to approve vendor' });
    }
    
    console.log(`Vendor ${vendorId} approved`);
    res.json({ success: true, message: 'Vendor approved' });
  });
});

// Reject vendor
router.post('/admin/vendor/:id/reject', (req, res) => {
  const vendorId = req.params.id;
  const { reason } = req.body;
  
  // Reset verification submission
  db.query(
    'UPDATE users SET verification_submitted = 0, verification_notes = ? WHERE id = ? AND role = "vendor"',
    [reason || 'Rejected by admin', vendorId],
    (err, result) => {
      if (err) {
        console.error('Error rejecting vendor:', err);
        return res.status(500).json({ error: 'Failed to reject vendor' });
      }
      
      console.log(`Vendor ${vendorId} rejected: ${reason}`);
      res.json({ success: true, message: 'Vendor rejected' });
    }
  );
});

// ===== BOOKINGS MANAGEMENT =====

// Get all bookings with user details
router.get('/admin/bookings/all', (req, res) => {
  const query = `
    SELECT 
      b.*,
      c.name as client_name,
      v.name as vendor_name
    FROM bookings b
    LEFT JOIN users c ON b.client_id = c.id
    LEFT JOIN users v ON b.vendor_id = v.id
    ORDER BY b.created_at DESC
    LIMIT 100
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching bookings:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results || []);
  });
});

// ===== WALLET MANAGEMENT =====

// Freeze user wallet
router.post('/admin/wallet/freeze', (req, res) => {
  const { user_id } = req.body;
  
  if (!user_id) {
    return res.status(400).json({ error: 'User ID required' });
  }
  
  // Add frozen flag to users table (you may need to add this column)
  db.query('UPDATE users SET wallet_frozen = 1 WHERE id = ?', [user_id], (err, result) => {
    if (err) {
      console.error('Error freezing wallet:', err);
      return res.status(500).json({ error: 'Failed to freeze wallet' });
    }
    
    console.log(`Wallet frozen for user ${user_id}`);
    res.json({ success: true, message: 'Wallet frozen' });
  });
});

// Unfreeze user wallet
router.post('/admin/wallet/unfreeze', (req, res) => {
  const { user_id } = req.body;
  
  if (!user_id) {
    return res.status(400).json({ error: 'User ID required' });
  }
  
  db.query('UPDATE users SET wallet_frozen = 0 WHERE id = ?', [user_id], (err, result) => {
    if (err) {
      console.error('Error unfreezing wallet:', err);
      return res.status(500).json({ error: 'Failed to unfreeze wallet' });
    }
    
    console.log(`Wallet unfrozen for user ${user_id}`);
    res.json({ success: true, message: 'Wallet unfrozen' });
  });
});

// ===== BLACKLIST MANAGEMENT =====

// Get all blacklisted users
router.get('/admin/blacklist', (req, res) => {
  db.query(
    'SELECT * FROM users WHERE blacklisted = 1 ORDER BY blacklisted_at DESC',
    (err, results) => {
      if (err) {
        console.error('Error fetching blacklist:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(results || []);
    }
  );
});

// Add user to blacklist
router.post('/admin/blacklist/add', (req, res) => {
  const { user_id, reason } = req.body;
  
  if (!user_id || !reason) {
    return res.status(400).json({ error: 'User ID and reason required' });
  }
  
  db.query(
    'UPDATE users SET blacklisted = 1, blacklist_reason = ?, blacklisted_at = NOW() WHERE id = ?',
    [reason, user_id],
    (err, result) => {
      if (err) {
        console.error('Error blacklisting user:', err);
        return res.status(500).json({ error: 'Failed to blacklist user' });
      }
      
      console.log(`User ${user_id} blacklisted: ${reason}`);
      res.json({ success: true, message: 'User blacklisted' });
    }
  );
});

// Remove user from blacklist
router.post('/admin/blacklist/remove', (req, res) => {
  const { user_id } = req.body;
  
  if (!user_id) {
    return res.status(400).json({ error: 'User ID required' });
  }
  
  db.query(
    'UPDATE users SET blacklisted = 0, blacklist_reason = NULL, blacklisted_at = NULL WHERE id = ?',
    [user_id],
    (err, result) => {
      if (err) {
        console.error('Error removing from blacklist:', err);
        return res.status(500).json({ error: 'Failed to remove from blacklist' });
      }
      
      console.log(`User ${user_id} removed from blacklist`);
      res.json({ success: true, message: 'User removed from blacklist' });
    }
  );
});

// ===== FRAUD MONITORING =====

// Get fraud alerts
router.get('/admin/fraud/alerts', (req, res) => {
  db.query(
    'SELECT * FROM fraud_alerts ORDER BY created_at DESC LIMIT 50',
    (err, results) => {
      if (err) {
        console.error('Error fetching fraud alerts:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(results || []);
    }
  );
});

// Check for duplicate NIN or bank accounts (fraud detection)
router.get('/admin/fraud/duplicates', (req, res) => {
  const query = `
    SELECT nin, COUNT(*) as count 
    FROM users 
    WHERE nin IS NOT NULL 
    GROUP BY nin 
    HAVING count > 1
    UNION
    SELECT bank_account, COUNT(*) as count 
    FROM users 
    WHERE bank_account IS NOT NULL 
    GROUP BY bank_account 
    HAVING count > 1
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error checking duplicates:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results || []);
  });
});

// ===== ANALYTICS =====

// Get comprehensive analytics
router.get('/admin/analytics', (req, res) => {
  // Get total revenue
  db.query('SELECT SUM(amount) as total FROM bookings WHERE status = "confirmed"', (err, revenueResults) => {
    const totalBookings = revenueResults?.[0]?.total || 0;
    const totalRevenue = totalBookings * 0.15;
    
    // Get completed bookings count
    db.query('SELECT COUNT(*) as total FROM bookings WHERE status = "confirmed"', (err, completedResults) => {
      const completedBookings = completedResults?.[0]?.total || 0;
      
      // Get active vendors count
      db.query('SELECT COUNT(*) as total FROM users WHERE role = "vendor" AND verified = 1', (err, vendorResults) => {
        const activeVendors = vendorResults?.[0]?.total || 0;
        
        // Get fraud alerts count
        db.query('SELECT COUNT(*) as total FROM fraud_alerts', (err, fraudResults) => {
          const fraudAlerts = fraudResults?.[0]?.total || 0;
          
          res.json({
            totalRevenue,
            completedBookings,
            activeVendors,
            fraudAlerts
          });
        });
      });
    });
  });
});

module.exports = router;
