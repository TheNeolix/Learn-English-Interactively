-- Migration: Base Database Schema
-- Target Database: MariaDB on db.r6.websupport.sk

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(50) NOT NULL,
    age_range VARCHAR(20) DEFAULT 'unknown',
    reset_token VARCHAR(64) NULL,
    reset_expires DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_progress (
    user_id INT PRIMARY KEY,
    points INT DEFAULT 0,
    completed TEXT NULL,
    scores TEXT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    subscription_tier VARCHAR(20) DEFAULT 'free',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
