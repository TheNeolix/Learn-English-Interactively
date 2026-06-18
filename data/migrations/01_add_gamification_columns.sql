-- Migration: Add gamification progress state columns to user_progress table
-- Target Database: MariaDB 11.4 on db.r6.websupport.sk

ALTER TABLE user_progress 
ADD COLUMN level INT DEFAULT 1,
ADD COLUMN streak_count INT DEFAULT 0,
ADD COLUMN streak_shields INT DEFAULT 2,
ADD COLUMN last_active_date DATE NULL,
ADD COLUMN unlocked_items TEXT NULL,
ADD COLUMN active_theme VARCHAR(50) DEFAULT 'default',
ADD COLUMN earned_xp_per_node TEXT NULL;
