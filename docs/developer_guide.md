# NeolixStudio Learn English - Developer Reference Guide

Welcome to the **NeolixStudio Learn English** developer reference! This document provides a deep dive into the platform's technical architecture, file system, database schemas, API controllers, and key algorithmic engine modules.

---

## 1. Architecture & Technology Stack

The application is built on a lightweight, decoupled stack to minimize overhead and load fast on mobile devices:
* **Frontend**: Vanilla HTML5, CSS3 (leveraging the OKLCH system for dynamic color variables), and ES6+ Vanilla JavaScript.
* **Backend**: PHP 8.x (`api.php`) serving as a RESTful controller/router.
* **Database**: MariaDB (MySQL), queried via secure PDO parameters in PHP to prevent SQL injection.
* **State Management**: The client browser stores progress in a single `userProgress` JavaScript object, which is synced to the backend database via asynchronous JSON payloads.

---

## 2. Directory Structure

```text
/
├── index.html                  # Landing and Authentication screen
├── dashboard.html              # Main learning dashboard containing roadmap, sidebar, shop
├── api.php                     # Core PHP controller & REST API router
├── db_config.example.php       # Reference database credentials configuration
├── db_config.php               # Local DB credentials (excluded from version control)
├── assets/                     # Sound bytes, icons, visual components, SVGs
├── css/
│   ├── main.css                # Base styling, typography system, global headers/footers, shop themes
│   ├── dashboard.css           # Grid layouts, SVG roadmap, modal styles, quest widgets
│   └── landing.css             # Log in / Sign up page specific designs
├── js/
│   ├── landing.js              # Authentication and validation routines
│   ├── dashboard.js            # Learning roadmap generation, shop operations, quest handling, exercises
│   ├── data.js                 # Local datasets fallback
│   ├── nav.js                  # Navigation drawer controller
│   ├── sync_sonar_issues.js    # Utility for SonarQube integration tracking
│   ├── validate_json.js        # Build-step vocabulary validator
│   └── write_db_config.js      # Configuration deployment utility script
├── data/
│   ├── migrations/             # Incremental SQL migration scripts
│   ├── A1/                     # Detailed lesson data files
│   └── quests.json             # Static configuration pool for daily quests
└── docs/                       # Developer and design guides
```

---

## 3. Database Schema

The database relies on three core tables structured in MariaDB.

### 3.1. `users` Table
Stores authentication records and account metadata:
* `id` (`INT AUTO_INCREMENT PRIMARY KEY`): Unique user ID.
* `email` (`VARCHAR(100) UNIQUE NOT NULL`): Account email address.
* `password_hash` (`VARCHAR(255) NOT NULL`): BCRYPT password hash.
* `username` (`VARCHAR(50) NOT NULL`): User display name.
* `age_range` (`VARCHAR(20) DEFAULT 'unknown'`): Marketing/demographic range.
* `reset_token` (`VARCHAR(64) NULL`): Password reset identification token.
* `reset_expires` (`DATETIME NULL`): Expiry timestamp for the reset token.
* `created_at` (`TIMESTAMP DEFAULT CURRENT_TIMESTAMP`): Registration date.

### 3.2. `user_progress` Table
Houses gamification states, scores, and shop configurations:
* `user_id` (`INT PRIMARY KEY`): References `users(id)` with cascade deletion.
* `points` (`INT DEFAULT 0`): The user's current XP currency balance.
* `completed` (`TEXT NULL`): Serialized JSON array of completed subsections.
* `scores` (`TEXT NULL`): Serialized JSON object mapping subsection IDs to highest quiz/exam scores.
* `level` (`INT DEFAULT 1`): Current roadmap level.
* `streak_count` (`INT DEFAULT 0`): Daily consecutive active days.
* `streak_shields` (`INT DEFAULT 2`): Purchased shields in inventory (capped at `3`).
* `last_active_date` (`DATE NULL`): Date of the user's last action (used for streak calculations).
* `unlocked_items` (`TEXT NULL`): Serialized JSON array of items unlocked in the shop.
* `active_theme` (`VARCHAR(50) DEFAULT 'default'`): The CSS theme currently active.
* `earned_xp_per_node` (`TEXT NULL`): Map tracking XP earned per task to enforce economy caps.
* `daily_quests_date` (`DATE NULL`): The calendar day for which current quests were assigned.
* `active_quests` (`TEXT NULL`): Serialized JSON list of today's generated daily quest objects.
* `quest_progress` (`TEXT NULL`): JSON mapping active quest IDs to current numeric progress values.
* `completed_quests_today` (`TEXT NULL`): Serialized list of quest IDs finished today.

### 3.3. `user_subscriptions` Table
* `user_id` (`INT PRIMARY KEY`): References `users(id)`.
* `role` (`VARCHAR(20) DEFAULT 'user'`): User permissions ('user', 'admin').
* `subscription_tier` (`VARCHAR(20) DEFAULT 'free'`): Payment tier ('free', 'premium').

---

## 4. API Controller Reference (`api.php`)

All communication to the server routes through `api.php` using Query Parameters and JSON POST payloads:

### `POST api.php?action=login`
* **Payload**: `{"email": "...", "password": "..."}`
* **Process**: Verifies matching email and hashes using `password_verify()`. If valid, starts the secure PHP session.
* **Return**: `{"success": true}` or `{"success": false, "error": "Hibás jelszó vagy e-mail"}`

### `GET api.php?action=get_session`
* **Process**: Queries the session cookie, returns logged-in user session context and fetches all columns from `user_progress` corresponding to the user ID.
* **Return**: User progress fields parsed to match standard JS format.

### `POST api.php?action=save_progress`
* **Payload**: JSON-serialized client-side progress object containing properties like `points`, `completed`, `scores`, etc.
* **Process**: Extracts all parameters and performs a parameter-bound `UPDATE` query targeting the user's row in the `user_progress` table.
* **Return**: `{"success": true}`

### `POST api.php?action=signup`
* **Payload**: `{"username": "...", "email": "...", "password": "...", "age_range": "..."}`
* **Process**: Hashes password with `password_hash()`, inserts into `users`, and creates a linked default row in `user_progress`.
* **Return**: `{"success": true}` or error details.

---

## 5. Core Engines & Logic

### 5.1. Secure Randomization Helper (`secureRandom`)
To comply with security and quality rules (e.g. SonarCloud S2245 targeting predictable pseudo-random number generation), the application avoids `Math.random()`:
```javascript
let seed = Date.now();
function secureRandom() {
    const crypto = globalThis.crypto || globalThis.window?.crypto;
    if (crypto?.getRandomValues) {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return array[0] / 4294967296; // Normalize to [0, 1)
    }
    // Fallback Linear Congruential Generator (LCG)
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
}
```
This is used for all exercises, shuffling cards, arranging chips, and selecting mini-quiz wrong answers.

### 5.2. Web Audio Synthesis Engine (`AudioSynth`)
Sound effects are dynamically synthesized on the fly via the browser's Web Audio API:
* **Waveforms**: Uses `sine` and `triangle` oscillators.
* **Frequencies**:
  * Correct Answer chime: C5 (`523.25Hz`) transitioned to E5 (`659.25Hz`).
  * Incorrect Answer buzzer: A3 (`220Hz`).
  * Completion Arpeggio: C5 (`523.25Hz`) -> E5 (`659.25Hz`) -> G5 (`783.99Hz`) -> C6 (`1046.50Hz`).
* **Volume Envelope**: Multiplies master volume variable by standard multiplier, decaying to `0.001` exponentially over the audio duration to prevent click sounds when the oscillator stops.

### 5.3. Shop and Theme Engine
* **Theme Purchases**: Handled via `unlockShopItem(itemId, cost, btnEl)`. Deducts XP from `userProgress.points`, updates `unlocked_items`, and triggers database sync.
* **Theme Activation**: Theme selections set the `userProgress.active_theme` property, save state, and trigger `updateProgressUI()`, which maps the theme selection to the root DOM document element using `document.documentElement.setAttribute('data-theme', themeName)`.
* **Button Syncer (`syncShopButtonsUI()`)**: Scans the DOM for purchase nodes, mapping button states depending on whether the items are:
  1. Locked/Available for purchase: Displays "Feloldás" (Unlock) and the XP cost.
  2. Unlocked but inactive: Displays "Aktiválás" (Activate).
  3. Currently Active: Displays "Aktiválva" (Activated) with a custom style.

### 5.4. Daily Quests Engine
* **Initialization**: Evaluates `daily_quests_date` in client-state against the current system date. If different, clears daily quest progress, increments active streak, pulls 3 random quests from the `data/quests.json` pool, and updates columns.
* **Tracking**: Core actions (such as completing an exercise, solving a quiz perfectly, or gaining XP) trigger check hooks:
  ```javascript
  // Example quest increment hook:
  // Updates quest progress, checks if target is reached, and awards rewards.
  ```

### 5.5. Lesson & Exercise Engines
The roadmap sections feature various exercise modalities:
1. **Explanation Module**: Display text instructions alongside speech synth options.
2. **Words Module**: Dynamic vocabulary lists featuring spelling card flips and audio synthesizers.
3. **Fill-in-the-Blanks**: Text inputs mapped against regex patterns.
4. **True/False**: Two-choice checks.
5. **Word-Order Chips**: Dynamic chips loaded from scrambled sentences.
   * **Contraction Quote Fix**: Scrambled text blocks with contractions containing single quotes (such as `don't`, `doesn't`) caused parsing syntax breaks when string-escaped inline in HTML. The engine resolves this by passing `this.textContent` to the chip selector handler:
     ```html
     <!-- Fixed code structure -->
     <button class="word-chip" onclick="selectQuizWordChip(this, this.textContent)">Word</button>
     ```

---

## 6. How to Add New Features

### 6.1. Adding a New Shop Theme
1. Add the CSS theme override variables in `css/main.css` under the corresponding attribute selector (e.g. `[data-theme="new_theme_name"]`).
2. Add the item card configuration in the HTML generator within `window.openShopModal` inside `js/dashboard.js`.
3. Map the purchase actions inside `syncShopButtonsUI()` to support state visualization.

### 6.2. Creating a Database Migration
1. Write a new SQL script in `data/migrations/` using the sequential naming prefix (e.g. `04_new_migration.sql`).
2. Execute the migration against the MariaDB environment.
3. If new columns were added, update the properties mapping within `api.php` under both the `get_session` read handler and the `save_progress` write queries.
