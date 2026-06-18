## 2024-05-24 - API Exception Information Exposure
**Vulnerability:** The PHP API endpoint (`api.php`) was returning database exception details directly to the client via JSON responses (e.g., `echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);`). This could leak database connection strings, table names, syntax errors, or server details to malicious actors.
**Learning:** Exception details must never be passed to the client. This exposes internal database architecture or other infrastructure secrets which could aid in planning targeted attacks.
**Prevention:** Catch exceptions and log the detailed message server-side using `error_log()`. Return generic, user-friendly error messages such as "Hiba történt az adatbázis csatlakozás során." to the client.
