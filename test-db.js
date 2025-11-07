// test-db.js
require('dotenv').config(); // Load the .env file
const { Pool } = require('pg');

// Check if the DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set in your .env file.');
  process.exit(1);
}

// Create a new pool using the same library as your server
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function testConnection() {
  console.log('Attempting to connect to the database...');
  let client;

  try {
    // Try to get a client from the pool
    client = await pool.connect();

    // Run a simple query to confirm the connection works
    const result = await client.query('SELECT NOW()');

    console.log('\n✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅');
    console.log('  CONNECTION SUCCESSFUL!');
    console.log('  Database time is:', result.rows[0].now);
    console.log('✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅\n');

  } catch (error) {
    console.error('\n❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌');
    console.error('  DATABASE CONNECTION FAILED:');

    // Log specific errors
    if (error.code === 'ETIMEDOUT') {
      console.error('  Error Code: ETIMEDOUT (Connection Timed Out)');
      console.error('  This is a network error. Your firewall or Supabase IP Allow-List is likely blocking the connection.');
    } else if (error.code === '28P01') {
      console.error('  Error Code: 28P01 (Authentication Failed)');
      console.error('  This means your password or username is incorrect in the DATABASE_URL.');
    } else {
      console.error('  Full Error:', error.message);
    }
    console.error('❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌\n');
  } finally {
    // Release the client and end the pool to exit the script
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

testConnection();