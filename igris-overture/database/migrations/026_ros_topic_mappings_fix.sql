-- Migration 026: Add direction column to ros_topic_mappings if missing.
-- This ensures the column exists for the BT editor dropdown query.

ALTER TABLE ros_topic_mappings
    ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'publish';

-- Backfill from message_type hint if possible
UPDATE ros_topic_mappings
    SET direction = 'subscribe'
WHERE LOWER(message_type) LIKE '%result%'
   OR LOWER(message_type) LIKE '%feedback%'
   OR LOWER(message_type) LIKE '%status%'
   AND direction = 'publish';
