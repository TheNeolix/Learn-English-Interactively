-- Migration: Add Unique Constraint to users.username
-- Target Database: MariaDB on db.r6.websupport.sk

-- Drop duplicate usernames (keeping the most recently created one) to allow adding the UNIQUE constraint
-- Note: This is a safe fallback if there are existing duplicates.
DELETE t1 FROM users t1
INNER JOIN users t2 
WHERE t1.id < t2.id AND t1.username = t2.username;

ALTER TABLE users ADD UNIQUE (username);
