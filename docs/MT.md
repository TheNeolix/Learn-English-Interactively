# Bugs encountered in testing each Feature:

# Feature 1

## Scenario 1.1: - new issue #184

The registration tab is inaccessible if an active guest wishes to register (clicking on the "regisztracio" tab does nothing)

## Scenario 1.2: - new issue #184

if a guest logins into an already existing account he is still logged in as a guest. No progress in transfered.

## Scenario 1.3: - new issue #184

Logout button not working

## Scenario 1.4: - Currently disabled for testing purposes

No email was received after 30 minutes. After retry still no email.

## Other points: - new issue #185

Server does not check for unique username.
At account creation there are no password requirements( 'test123' worked). At password reset ('Profilom') there are password requirements.

---

# Feature 2:

Skipped as per instructions

---

# Feature 3: - new issue #186

No subscription-only lessons were found and everything seems to be unlocked. (Issue reported)

## Other points: - new issue #184

Even with 2 shields in my possession clicking on 'vasarlas' for 'Streak Pajzs' opens a pop up stating: 'Maximum 3 pajzsod lehet egyszerre!'

---

# Feature 4: - new issue #187

Stopwatch never started ticking.

## Other points: - new issue #184

Everything else in working order

Even XP which doesn't work on the Quizes (further info in Feature 6)

---

# Feature 6:

## Scenario 6.1: - new issue #188

Once the "Fill in the Blanks" quiz question is answered there is no XP being awarded dynamically.

Once the "Fill in the Blanks" quiz is done there is no XP awarded

## Scenario 6.3: - new issue #189

Once the TRUE/FALSE quiz is finished the "kerdes counter" keeps going up overflowing to '11/10 '. Looking back at other quizes same issue applies

## Other points: - new issue #190 (this is corrected for only incorrect answers, correct answers don't need the explanation block)

While stated in the scenario given "

**WHEN** the user submits the correct choice
**THEN** the system should validate, update the score, and display the detailed explanation text block "

When the correct answer is picked no such explanation pops up.
