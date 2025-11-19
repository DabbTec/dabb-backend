// api/migrate.js
// Run this script once to create the required tables in your Neon/Postgres DB.
// Usage (PowerShell):
//   node .\api\migrate.js

import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Set it in your .env or environment.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const statements = [
  `CREATE TABLE IF NOT EXISTS prospects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    company VARCHAR(100),
    service VARCHAR(100),
    source VARCHAR(100),
    status VARCHAR(50),
    priority VARCHAR(50),
    value NUMERIC,
    notes TEXT,
    lastContact TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS consultations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100),
    date TIMESTAMP,
    notes TEXT
  );`,

  `CREATE TABLE IF NOT EXISTS email_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    content TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS custom_email_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT NOW()
  );`,
];

async function runMigrations() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  try {
    for (const sql of statements) {
      console.log('Running statement:');
      console.log(sql.split('\n')[0].trim(), '...');
      await client.query(sql);
    }

    console.log('\n✅ Migrations complete. Tables are created (if they did not exist).');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
