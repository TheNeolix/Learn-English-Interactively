## 2024-05-24 - API Exception Information Exposure
**Vulnerability:** The PHP API endpoint (`api.php`) was returning database exception details directly to the client via JSON responses (e.g., `echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);`). This could leak database connection strings, table names, syntax errors, or server details to malicious actors.
**Learning:** Exception details must never be passed to the client. This exposes internal database architecture or other infrastructure secrets which could aid in planning targeted attacks.
**Prevention:** Catch exceptions and log the detailed message server-side using `error_log()`. Return generic, user-friendly error messages such as "Hiba történt az adatbázis csatlakozás során." to the client.
## 2024-06-19 - Session Fixation in PHP
**Vulnerability:** The application did not regenerate the session ID upon user authentication or registration.
**Learning:** Without regenerating the session ID, the application is vulnerable to Session Fixation attacks, where an attacker can set a known session ID and use it to hijack the user's session after they log in.
**Prevention:** Always call `session_regenerate_id(true);` upon privilege level changes (e.g., login, registration) to issue a new session ID and invalidate the old one.
