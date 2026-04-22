const mysql = require('mysql');

// Create the connection FIRST, then use it
const connection = mysql.createConnection({
  host:     'localhost',
  user:     'xiaomior_cynora',
  password: 'g1y^e)H$ibGrEuf6',
  database: 'xiaomior_cynora_ng'
});

// Now connect using the variable we just created
connection.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    return;
  }
  console.log('✅ Connected to MySQL database: xiaomior_cynora_ng');
});

// Keep connection alive (prevents timeout on shared hosting)
setInterval(() => {
  connection.query('SELECT 1', (err) => {
    if (err) console.error('Keep-alive query failed:', err.message);
  });
}, 60000); // ping every 60 seconds

module.exports = connection;
