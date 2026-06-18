-- Migration: Add Daily Quests columns to user_progress table
-- Target Database: MariaDB on db.r6.websupport.sk

ALTER TABLE user_progress 
ADD COLUMN daily_quests_date DATE NULL,
ADD COLUMN active_quests TEXT NULL,
ADD COLUMN quest_progress TEXT NULL,
ADD COLUMN completed_quests_today TEXT NULL;
