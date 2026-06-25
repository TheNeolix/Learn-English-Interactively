<?php
/**
 * Database Cleanup Cron Job
 * Deletes unverified user accounts older than 7 days.
 * Recommended Cron schedule: 0 3 * * 0 (Every Sunday at 3:00 AM)
 */

if (php_sapi_name() !== 'cli' && empty($_GET['run'])) {
    http_response_code(403);
    die("Access denied. This script should be run via CLI.");
}

require_once __DIR__ . '/db_config.php';

try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);

    // Note: If you have foreign keys set up with ON DELETE CASCADE, deleting from users
    // will automatically clean up user_subscriptions and user_progress.
    // If not, you may want to delete from child tables first. Assuming CASCADE or ignoring for now
    // as it's a basic cleanup. To be safe, we'll manually delete child records.

    $pdo->beginTransaction();

    // Find users to delete
    $stmtFind = $pdo->query("SELECT id FROM users WHERE is_verified = 0 AND created_at < NOW() - INTERVAL 7 DAY");
    $usersToDelete = $stmtFind->fetchAll(PDO::FETCH_COLUMN);

    if (count($usersToDelete) > 0) {
        $inQuery = implode(',', array_fill(0, count($usersToDelete), '?'));
        
        // Delete progress
        $stmtDelProgress = $pdo->prepare("DELETE FROM user_progress WHERE user_id IN ($inQuery)");
        $stmtDelProgress->execute($usersToDelete);

        // Delete subscriptions
        $stmtDelSub = $pdo->prepare("DELETE FROM user_subscriptions WHERE user_id IN ($inQuery)");
        $stmtDelSub->execute($usersToDelete);

        // Delete users
        $stmtDelUsers = $pdo->prepare("DELETE FROM users WHERE id IN ($inQuery)");
        $stmtDelUsers->execute($usersToDelete);
    }

    $pdo->commit();

    $logMessage = "[" . date('Y-m-d H:i:s') . "] Successfully deleted " . count($usersToDelete) . " unverified abandoned accounts.\n";
    echo $logMessage;
    // error_log($logMessage, 3, __DIR__ . '/cron.log'); // Uncomment to log to a file

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $errorMsg = "[" . date('Y-m-d H:i:s') . "] Cleanup Error: " . $e->getMessage() . "\n";
    echo $errorMsg;
    // error_log($errorMsg, 3, __DIR__ . '/cron.log');
}
