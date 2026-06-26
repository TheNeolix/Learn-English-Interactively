-- Migration: Email Verification
-- Adds is_verified and verification_token columns to the users table

ALTER TABLE users 
ADD COLUMN is_verified TINYINT(1) DEFAULT 0 AFTER password_hash,
ADD COLUMN verification_token VARCHAR(64) DEFAULT NULL AFTER is_verified;
