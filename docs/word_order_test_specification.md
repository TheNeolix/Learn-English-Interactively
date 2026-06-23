# Test Specification - Interactive Word-Order Chips

This document outlines the detailed manual and automated test cases for the **Interactive Word-Order (Szórendezés) Component**. Use this specification to implement end-to-end (E2E) browser tests (e.g., using Playwright or Cypress) and unit tests.

---

## 1. Schema Validation & Warning Logs (Unit/Integration Test)

### Test Case 1.1: Standard Schema Validation
- **Objective**: Ensure the system loads the correct unified schema structure without warnings.
- **Input Data**:
  ```json
  {
    "id": "wo_001",
    "scrambledWords": ["Can", "you", "help", "me"],
    "correctAnswer": "Can you help me?"
  }
  ```
- **Expectation**:
  - The object parses successfully.
  - No `console.warn` is printed.

### Test Case 1.2: Legacy Schema Warning Trigger
- **Objective**: Ensure the system prints an explicit schema validation warning when legacy formats are parsed.
- **Input Data**:
  ```json
  {
    "id": "wo_legacy_01",
    "scrambled": ["She", "is", "a", "teacher"],
    "correct": "She is a teacher."
  }
  ```
- **Expectation**:
  - The system prints `[Schema Validation Warning] Legacy word-order format detected for item ID: wo_legacy_01` in the console.
  - Fallbacks allow the question to render successfully using the legacy properties.

---

## 2. Component Render & Initial State (UI/E2E Test)

### Test Case 2.1: Initial Layout Elements
- **Objective**: Verify that all interactive UI containers and elements exist on start.
- **Preconditions**: Navigate to a word-order question card.
- **Assertions**:
  - A container element with ID `quiz-chips-source` (or `chips-source-[index]` in exams) is visible.
  - An answer zone element with ID `quiz-answer-zone` (or `answer-zone-[index]` in exams) is visible.
  - The answer zone contains a placeholder element with class `.answer-placeholder` and text `"Kattints a szavakra a helyes sorrendben..."` (or `"Kattints a szavakra..."`).
  - The number of child buttons (chips) in the source container equals the length of `scrambledWords`.

---

## 3. Tap Interactivity & State Transitions (UI/E2E Test)

### Test Case 3.1: Moving Chip from Pool to Answer Zone
- **Objective**: Verify that tapping a word chip moves it to the target sentence line.
- **Action**: Click the first word chip in the source container.
- **Assertions**:
  - The clicked chip receives the class `.used` and its `disabled` attribute is set to `true` (or its style is set to `display: none` / hidden).
  - A new chip with the class `.placed` containing the same text is appended to the answer zone.
  - The placeholder element `.answer-placeholder` is removed from the answer zone.

### Test Case 3.2: Returning Chip from Answer Zone to Pool
- **Objective**: Verify that tapping a placed chip returns it back to the source pool.
- **Preconditions**: At least one chip has been moved to the answer zone (as in Test Case 3.1).
- **Action**: Click the placed chip inside the answer zone.
- **Assertions**:
  - The placed chip is removed from the answer zone.
  - The corresponding source chip has its `.used` class removed, its `disabled` attribute is set to `false`, and is visible again.
  - If the answer zone is now empty, the placeholder element `.answer-placeholder` is restored.

---

## 4. Reset Interaction (UI/E2E Test)

### Test Case 4.1: Resetting the Exercise
- **Objective**: Verify that clicking the reset link clears all user progress for the current question.
- **Preconditions**: Multiple chips have been placed in the answer zone.
- **Action**: Click the `"Visszaállítás"` (or reset) button/link.
- **Assertions**:
  - All placed chips inside the answer zone are removed.
  - The placeholder element `.answer-placeholder` is visible inside the answer zone.
  - All source chips in the pool are re-enabled (`disabled` attribute is removed, `.used` class is removed, and they are visible).

---

## 5. Grading and Verification Logic (UI/E2E Test)

### Test Case 5.1: Grading a Correct Sentence
- **Objective**: Verify that a correctly constructed sentence receives positive feedback, awards XP, and locks inputs.
- **Preconditions**:
  - Question: `"She has a garden."` (`correctAnswer` = `"She has a garden."`)
- **Action**:
  1. Click chips in order: `"She"` -> `"has"` -> `"a"` -> `"garden"`.
  2. Click the check/submit button.
- **Assertions**:
  - The answer zone border color transitions to success green.
  - A success feedback element appears containing the text `"✓ Helyes!"` and `"A mondat: \"She has a garden.\""`.
  - All word chips in both the source container and the answer zone are fully disabled.
  - Correct audio playback synthesis is triggered (`AudioSynth.playCorrect()`).

### Test Case 5.2: Grading an Incorrect Sentence
- **Objective**: Verify that an incorrectly constructed sentence receives error feedback and locks inputs.
- **Preconditions**:
  - Question: `"She has a garden."` (`correctAnswer` = `"She has a garden."`)
- **Action**:
  1. Click chips in order: `"garden"` -> `"has"` -> `"a"` -> `"She"`.
  2. Click the check/submit button.
- **Assertions**:
  - The answer zone border color transitions to error red.
  - An error feedback element appears containing the text `"✗ Helytelen!"` and `"A helyes mondat: \"She has a garden.\""`.
  - All word chips in both containers are disabled.
  - Incorrect audio playback synthesis is triggered (`AudioSynth.playIncorrect()`).
  - Normalization check successfully ignored punctuation/capitalization differences when comparing user input to `correctAnswer` (i.e. `"she has a garden"` is graded as correct).
