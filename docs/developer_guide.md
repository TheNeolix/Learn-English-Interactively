# NeolixStudio Learn English - Developer Reference Guide

Welcome to the **NeolixStudio Learn English** codebase! This document outlines the architecture, file structure, API endpoints, and core mechanics of the platform to help onboard new developers quickly.

---

## 1. Architecture Overview

The application is built using a lightweight stack:
- **Frontend**: Vanilla HTML5, CSS3 (with OKLCH CSS Variables), and Vanilla JavaScript (ES6+).
- **Backend**: PHP 8.x (`api.php`) serving as a RESTful API layer.
- **Database**: MariaDB (MySQL), accessed via PDO in PHP.
- **State Management**: Client-side state is stored in the `userProgress` JavaScript object and synced asynchronously to the backend database.

---

## 2. File Structure

```text
/
├── index.html                # Landing page
├── dashboard.html            # Main gamified learning dashboard
├── api.php                   # Core REST API controller
├── db_config.php             # Database connection credentials
├── assets/                   # Images, SVGs, and static media
├── css/
│   ├── main.css              # Core typography, themes, colors, utility classes
│   ├── dashboard.css         # Layouts for roadmap, sidebar, modals
│   └── landing.css           # Landing page specific styles
├── js/
│   ├── landing.js            # Auth handlers for login/registration
│   └── dashboard.js          # Core gamification logic, state sync, roadmap, shop, quests
├── data/
│   ├── migrations/           # SQL scripts for DB schemas
│   └── A1_vocabulary.json    # Static JSON dictionaries for lessons
└── docs/                     # Design and Developer guides
```

---

## 3. Core Mechanics

### 3.1. Authentication & Session
- Users login via the landing page (`js/landing.js`).
- The login POST request goes to `api.php?action=login`.
- The PHP backend sets an `HttpOnly` secure session cookie.
- When `dashboard.html` loads, it calls `api.php?action=get_session` to retrieve the user's progress and stats, injecting it into the global `userProgress` JS variable.

### 3.2. State Management & Gamification Sync
- **State Object**: `userProgress` acts as the single source of truth for the user's progress, points, active theme, unlocked items, and daily quests.
- **Save Trigger**: The `saveUserProgress()` function is called asynchronously whenever a user completes a lesson, buys a shop item, or earns XP. It serializes the complex JSON arrays (like `unlocked_items`) and POSTs them to `api.php?action=save_progress`.

### 3.3. Daily Quests
- **Definition**: The quests are generated from a local `quests.json` file (if externalized) or hardcoded logic. 
- **Validation**: When the dashboard initializes, it checks the `last_login_date`. If it's a new day, the streak logic increments and new daily quests are initialized.
- **Completion**: As users perform actions (e.g., earning XP, finishing tests), hooks like `addXP()` update the internal quest progress counters and call `renderQuestModalContent()` to reflect changes visually.

### 3.4. Jutalom Bolt (The Shop Engine)
- The Shop UI allows users to spend XP points on cosmetic themes and streak shields.
- **Unlocking**: Calling `unlockShopItem(itemId, cost, btnEl)` checks XP balance, deducts it, and pushes the `itemId` into `userProgress.unlocked_items`.
- **Activation**: The `activateTheme()` function updates `userProgress.active_theme` and triggers `syncShopButtonsUI()`, which immediately scans the DOM and flips all relevant buttons to "Aktiválva", while overriding the HTML `data-theme` attribute to apply custom OKLCH color palettes from `main.css`.

---

## 4. API Reference (`api.php`)

All requests go to `api.php` with an `action` query parameter. It uses a `switch($_GET['action'])` router.

### `POST ?action=login`
- **Body**: JSON `{"email": "...", "password": "..."}`
- **Returns**: `{"success": true}` or error. Sets secure session.

### `GET ?action=get_session`
- **Returns**: The complete gamification state for the active user, mapped from the MariaDB `user_progress` table.

### `POST ?action=save_progress`
- **Body**: JSON serialized `userProgress` object.
- **Logic**: Parses the JSON and executes an `UPDATE` statement targeting the user's row, storing complex arrays back into `TEXT` columns in MariaDB.

### `POST ?action=signup`
- **Body**: JSON `{"username": "...", "email": "...", "password": "..."}`
- **Logic**: Hashes password using `password_hash()`, creates user, and initializes a blank gamification row in the `user_progress` table.

---

## 5. Adding New Features

**1. Creating a new Shop Theme:**
- Add the CSS rules to `css/main.css` under `[data-theme="new-theme-name"]`.
- Add the HTML button for it in the Shop Modal string inside `window.openShopModal` in `js/dashboard.js`.
- Add the button tracking logic to `syncShopButtonsUI()` to handle the button state mapping.

**2. Adding a new Database Column:**
- Create an SQL migration file in `data/migrations/`.
- Apply it to MariaDB.
- Add the column mapping logic to both `handleSaveProgress()` and `handleGetSession()` inside `api.php`.
- Access it instantly in the frontend via `userProgress.new_column_name`.
