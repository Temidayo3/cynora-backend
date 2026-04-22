const express = require('express');
const router = express.Router();
const db = require('../db');

// Create booking
router.post('/bookings', (req, res) => {
  const { client_id, service_id, date, time } = req.body;
  db.query('SELECT price, vendor_id FROM services WHERE id = ?', [service_id], (err, service) => {
    if (err || !service.length) return res.status(404).json({ error: 'Service not found' });
    const amount = service[0].price;
    db.query('INSERT INTO bookings (client_id, vendor_id, service_id, date, time, amount, status) VALUES (?, ?, ?, ?, ?, ?, "escrow")', 
      [client_id, service[0].vendor_id, service_id, date, time, amount], (err, result) => {
        if (err) return res.status(500).json({ error: 'Failed' });
        // Deduct from client wallet, add points
        db.query('UPDATE users SET wallet = wallet - ?, points = points + ? WHERE id = ?', [amount, Math.floor(amount / 10), client_id]);
        res.json({ success: true });
      });
  });
});

// Vendor accept/decline
router.post('/bookings/:id/action', (req, res) => {
  const { action } = req.body;
  const status = action === 'accept' ? 'accepted' : 'declined';
  db.query('UPDATE bookings SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Failed' });
    if (status === 'declined') {
      db.query('SELECT amount, client_id FROM bookings WHERE id = ?', [req.params.id], (err, b) => {
        db.query('UPDATE users SET wallet = wallet + ? WHERE id = ?', [b[0].amount, b[0].client_id]);
      });
    }
    res.json({ success: true });
  });
});

// Client confirm
// Confirm booking (client confirms service was completed)
router.post('/bookings/:id/confirm', (req, res) => {
  const bookingId = req.params.id;
  
  console.log(`Confirming booking #${bookingId}...`);
  
  // Get booking details first
  db.query('SELECT * FROM bookings WHERE id = ?', [bookingId], (err, bookings) => {
    if (err) {
      console.error('Error fetching booking:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!bookings.length) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    const booking = bookings[0];
    const vendorShare = booking.amount * 0.85;
    
    console.log(`Booking found: Vendor ID = ${booking.vendor_id}, Amount = ${booking.amount}`);
    
    // Update booking status
    db.query('UPDATE bookings SET status = "confirmed", completed_at = NOW() WHERE id = ?', [bookingId], (err) => {
      if (err) {
        console.error('Error updating booking status:', err);
        return res.status(500).json({ error: 'Failed to update booking' });
      }
      
      console.log(`Booking #${bookingId} status updated to confirmed`);
      
      // Add money to vendor wallet
      db.query('UPDATE users SET wallet = wallet + ? WHERE id = ?', [vendorShare, booking.vendor_id], (err) => {
        if (err) {
          console.error('Error updating wallet:', err);
        } else {
          console.log(`Vendor ${booking.vendor_id} wallet updated: +${vendorShare}`);
        }
      });
      
      // INCREMENT JOBS COMPLETED - THIS IS THE IMPORTANT PART!
      db.query('UPDATE users SET jobs_completed = jobs_completed + 1 WHERE id = ?', [booking.vendor_id], (err, result) => {
        if (err) {
          console.error('Error updating jobs_completed:', err);
        } else {
          console.log(`Vendor ${booking.vendor_id} jobs_completed increased! Rows affected: ${result.affectedRows}`);
        }
      });
      
      res.json({ success: true, message: 'Booking confirmed!' });
    });
  });
});

// Function to update vendor level based on jobs completed
function updateVendorLevel(vendorId) {
  db.query('SELECT jobs_completed FROM users WHERE id = ? AND role = "vendor"', [vendorId], (err, results) => {
    if (err || !results.length) return;
    
    const jobs = results[0].jobs_completed || 0;
    let level = 1;
    
    // Level logic
    if (jobs >= 31) level = 4; // Premium
    else if (jobs >= 21) level = 3; // Professional  
    else if (jobs >= 11) level = 2; // Rising Star
    else level = 1; // Beginner
    
    db.query('UPDATE users SET vendor_level = ? WHERE id = ?', [level, vendorId], (err) => {
      if (err) {
        console.error('Failed to update vendor level:', err);
      } else {
        console.log(`Vendor ${vendorId} level updated to ${level}`);
      }
    });
  });
}

// Get bookings
router.get('/bookings', (req, res) => {
  const { user_id, role } = req.query;
  const field = role === 'vendor' ? 'vendor_id' : 'client_id';
  db.query(`SELECT * FROM bookings WHERE ${field} = ?`, [user_id], (err, results) => res.json(results || []));
});

// Add review
router.post('/reviews', (req, res) => {
  const { booking_id, rating, comment } = req.body;
  db.query('INSERT INTO reviews (booking_id, rating, comment) VALUES (?, ?, ?)', [booking_id, rating, comment], (err) => {
    if (err) return res.status(500).json({ error: 'Failed' });
    res.json({ success: true });
  });
});

module.exports = router;