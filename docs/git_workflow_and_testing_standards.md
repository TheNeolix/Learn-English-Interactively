# Neolix Studio Git Workflow & QA Standards Guide

This document outlines the standard step-by-step workflow for managing code branches, submitting pull requests via the GitHub Desktop application, and the testing requirements for future development.

---

## Part 1: GitHub Desktop Step-by-Step Workflow

Always perform development tasks using a dedicated feature branch. Follow these steps sequentially:

### 1. Preparing the Workspace
1. Open **GitHub Desktop**.
2. Select your repository in the top-left dropdown.
3. In the **Current Branch** dropdown (middle-top), select **`develop`**.
4. Click **Fetch origin** (top-right). If there are updates, click **Pull origin** to download the latest changes.

### 2. Creating a New Feature Branch
1. Click the **Current Branch** dropdown.
2. Click **New Branch**.
3. Name your branch using the prefix `feature/` or `fix/` followed by a descriptive name:
   * Example: `feature/streak-shield-logic` or `fix/word-order-click`
4. Choose to base your branch on **`develop`** (do NOT base it on `main`).
5. Click **Create Branch**.

### 3. Making and Committing Changes
1. Edit code in your IDE/editor as usual.
2. Switch back to **GitHub Desktop**. You will see the changed files listed on the left sidebar.
3. Check the checkboxes next to the files you want to commit.
4. At the bottom-left, fill in the commit details:
   * **Summary (Required)**: Keep it concise and use semantic formatting if possible (e.g., `fix: update streak rendering offset` or `feat: add contact form validations`).
   * **Description (Optional)**: Provide brief context if the changes are complex.
5. Click the blue **Commit to [your-branch-name]** button.

### 4. Creating the Pull Request (PR)
1. Click **Publish branch** at the top right to upload the branch to GitHub.
2. A button labeled **Create Pull Request** will appear. Click it. This opens GitHub in your browser.
3. **CRITICAL STEP**: On the GitHub PR page, make sure the destination target is set correctly:
   * **base**: `develop` $\leftarrow$ **compare**: `feature/your-branch-name`
4. Title the PR clearly, write a short description of what was changed, and submit the PR.

---

## Part 2: Industry-Standard Development & QA Policy

The workflow for promoting code to the production environment consists of two stages:

```
[Feature Branch] ---> [develop branch] ---> [main branch]
                      (Testing Env)         (Production Env)
```

1. **Feature/Fix Branch to `develop`**: Where active code reviews, automated scans, and manual QA validation happen.
2. **`develop` to `main`**: A standard pull request to release fully vetted, stable code into production.

---

## Part 3: Automated Testing Matrix

To ensure development velocity is not stalled by unnecessary testing overhead, use this matrix to decide what requires automated tests.

### 🔴 Automated Tests are MANDATORY for:
* **Business Logic & Calculations**: Scoring engines, leveling/XP mathematics, streak calculations, timer resets, and shop transaction/point deductions.
* **API Endpoints & Database Scripts**: Any PHP endpoints (like `api.php`), API parameters, SQL queries, or integrations with third-party databases/Supabase.
* **Security & Input Validation**: Email/phone validators, security tokens, CSRF protection, and encryption routines.
* **Complex Data State Manipulations**: Helper files that serialize, parse, or structure progress logs.

### 🟢 Automated Tests are NOT Required (Manual Visual QA is Sufficient) for:
* **Layout, Styling & Spacing**: CSS rules, responsive layout updates, sticky alignments, colors, gradients, and font adjustments.
* **Static Text or Translations**: Editing Hungarian/English vocabulary dictionary files, adding copy text, or fixing typos.
* **Simple Micro-Animations**: CSS transitions, element hover effects, or basic entrance animations.
* **Pure Tracking tags**: Non-critical analytics pixels or pageview counters.
