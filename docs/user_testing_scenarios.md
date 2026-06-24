# Neolix English Interactively - Complete Application Test Specification

This document outlines the complete BDD test specification for the application, defined using the **GIVEN-WHEN-THEN** format (Behavior-Driven Development). These scenarios are intended to guide a junior developer in setting up automated end-to-end (E2E) tests using Cypress, Playwright, or similar testing frameworks.

---

## Feature 1: User Authentication & Onboarding

### Scenario 1.1: Registration (Sign-up) & Guest Data Migration
**GIVEN** the user has logged some points and completed sections as a guest
**AND** the user is on the registration modal
**WHEN** the user inputs a unique username (maximum 50 characters)
**AND** inputs a valid unique email address
**AND** inputs a password with 6 or more characters
**AND** submits the registration form
**THEN** the server should regenerate the session ID to prevent fixation
**AND** create a new user account with hashed password credentials
**AND** migrate the guest points, scores, and completed sections to the database
**AND** log the user in automatically, initializing their logged-in dashboard session

### Scenario 1.2: Login Flow
**GIVEN** the user has registered credentials
**AND** is on the login modal
**WHEN** the user enters their registered email and correct password
**AND** clicks the login button
**THEN** the server should authenticate the user
**AND** regenerate the session ID
**AND** load the user's progress data
**AND** display the logged-in user profile header instead of landing prompts

### Scenario 1.3: Logout Flow
**GIVEN** the user is logged into their account
**WHEN** the user clicks the "Kijelentkezés" (Logout) button
**THEN** the server should invalidate the session and destroy session cookies
**AND** reset the client-side state
**AND** redirect the user to the public landing section / initial guest layout

### Scenario 1.4: Password Reset Link Validation (Host Injection Guard)
**GIVEN** the user triggers the "forgot password" action
**WHEN** the server constructs the password reset link
**THEN** the server must validate the host against a hardcoded config or strict domain allowlist
**AND** ignore user-supplied HTTP Host header changes
**AND** deliver a secure link to the user's email address

---

## Feature 2: Course Navigation & Interface Control

### Scenario 2.1: Sidebar Accordion Progression & Highlight State
**GIVEN** the user loads the course dashboard
**WHEN** the user clicks on a level accordion header (e.g., "A1 - Kezdő")
**THEN** the accordion should slide open to display its subsections
**AND** keep other unselected accordions closed
**AND** when clicking a subsection link (e.g., "Létige / To Be"), highlight it as the active item
**AND** load the lesson content inside the main viewport

### Scenario 2.2: Mobile Sidebar Drawer Toggle
**GIVEN** the user is viewing the page on a mobile viewport (width < 768px)
**WHEN** the user taps the mobile menu/drawer toggle button
**THEN** the sidebar drawer should slide in or out depending on toggle state
**AND** clicking a section link inside the drawer should automatically close the drawer after loading the content

---

## Feature 3: Access Control & Progression Locking

### Scenario 3.1: Guest Lock Restriction & Paywall Trigger
**GIVEN** the user is using a free guest account
**WHEN** the user attempts to click on a subscription-only lesson or exam (indicated by a lock icon 🔒)
**THEN** the navigation block should prevent the content from rendering
**AND** display the subscription paywall modal prompt ("Szerezz Teljes Hozzáférést")

---

## Feature 4: Lesson Completion & Stopwatch Statistics

### Scenario 4.1: Manual Lesson Completion & Rewards
**GIVEN** the user is viewing an uncompleted subsection
**AND** the stopwatch timer is ticking
**WHEN** the user clicks the "Teljesítettem (+5 pont)" completion button
**THEN** the stopwatch should stop ticking
**AND** reward the user with exactly `+5` points (XP)
**AND** display a floating text pop animation `"+5 XP! 🎉"` above the button container
**AND** update the button state to a disabled `"Teljesítve ✓"` state
**AND** update the user's total time spent and exercises completed count in the dashboard database
**AND** persist this updated state

---

## Feature 5: Streak Shield Mechanics

### Scenario 5.1: Multi-Day Streak Protection Simulation
**GIVEN** the user has an active daily streak of `10` days
**AND** the user has `3` streak shields owned
**AND** the user does not log in for `2` days
**WHEN** the user loads the dashboard
**THEN** the system should detect `2` missed days
**AND** deduct exactly `2` streak shields (leaving `1` shield)
**AND** maintain the active streak count intact at `10`
**AND** display a warning banner: *"Pajzs elhasználva! Napi szériád megvédve. Elhasznált: 2 db, maradt: 1 db."*

### Scenario 5.2: Streak Shield UI & Limit Cap
**GIVEN** the user owns `3` streak shields
**WHEN** the user views the shop section
**THEN** the "Buy Shield" buttons should render as disabled
**AND** display the label `"Megtelt"` (preventing purchases beyond the max limit of 3)
**AND** the dashboard header should render exactly `3` filled shield icons

---

## Feature 6: Practice Quiz Engines

### Scenario 6.1: Fill in the Blanks Quiz Exercise
**GIVEN** the user starts a "Fill in the Blanks" quiz
**WHEN** the questions load
**THEN** sentences containing blanks like `___` should be rendered
**AND** the answers grid must display exactly 4 multiple-choice options (including the correct answer shuffled randomly)
**AND** selecting the correct answer should play a success audio chime
**AND** award `+1` XP dynamically

### Scenario 6.2: Word-Order Sentence Builder
**GIVEN** the user starts a "Word-Order" quiz
**WHEN** the question renders
**THEN** it must show the Hungarian guideline prompt
**AND** display the scrambled words as clickable chips (handling single quotes in words like `"don't"` and `"doesn't"` correctly without syntax errors)
**WHEN** the user clicks chips in sequential order
**THEN** they should be placed inside the answer zone in that order
**AND** clicking the Reset button should return all words to the source bin
**AND** clicking "Ellenőrzés" should evaluate the answer and display the Hungarian translation explanation below it

### Scenario 6.3: True or False Questions
**GIVEN** the user starts a "True or False" quiz
**WHEN** the question renders
**THEN** it must display a question statement
**AND** show exactly two choice options: `"Igaz"` and `"Hamis"`
**WHEN** the user submits the correct choice
**THEN** the system should validate, update the score, and display the detailed explanation text block

### Scenario 6.4: Quiz Completion States & Retrying
**GIVEN** the user finishes the last question of a quiz
**WHEN** the results screen loads
**THEN** the score header must dynamically calculate the score and show `X / Y`
**AND** if the user passed (score >= 50%), show: `"Szép munka! Folytathatod a következő leckével."` and unlock the completion action
**AND** if the score was 100%, trigger the quest progress check for `"perfect_quiz"`
**AND** if the user failed (score < 50%), show: `"Ezt még gyakorolni kell. Nézd át a hibákat és próbáld újra!"` and display an `"Újrapróbálkozás"` button
**WHEN** the user clicks `"Újrapróbálkozás"`
**THEN** the quiz state should reset back to question 1 and reload the item list

---

## Feature 7: Daily Quests Tracker

### Scenario 7.1: Daily Quest Completion check
**GIVEN** the user has a daily quest: `"complete_lesson"` (Complete 1 lesson)
**WHEN** the user completes their first lesson of the day
**THEN** the quest tracker should dispatch progress update
**AND** mark the quest as completed
**AND** update the quest UI visually to show a checkmark or completed badge
