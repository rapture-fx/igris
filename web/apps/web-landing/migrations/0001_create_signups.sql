-- Migration: Create signups table for early access emails
-- Database: D1
-- Created: 2024-11-14

CREATE TABLE IF NOT EXISTS signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    company TEXT NOT NULL,
    plan_interest TEXT NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_signups_email ON signups(email);

-- Create index for timestamp queries
CREATE INDEX IF NOT EXISTS idx_signups_created_at ON signups(created_at);
