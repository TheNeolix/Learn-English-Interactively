<?php
/**
 * Database Migration Runner Utility
 * Run locally via CLI: php migrate.php
 * Run remotely via HTTP: https://neolix.studio/migrate.php?token=YOUR_MIGRATION_TOKEN
 */

// Prevent caching
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

// Load database configuration
$configPath = __DIR__ . '/db_config.php';
if (!file_exists($configPath)) {
    echo json_encode(['success' => false, 'error' => 'db_config.php not found.']);
    exit(1);
}
require_once $configPath;

// Determine if we are running in CLI or HTTP
$isCli = (php_sapi_name() === 'cli');

// Token authentication for HTTP runs
if (!$isCli) {
    // Define a secure migration token from environment variable or fallback to a hardcoded constant
    // We get the token from a secure header or a GET parameter
    $expectedToken = getenv('MIGRATION_TOKEN');
    if (!$expectedToken && defined('MIGRATION_TOKEN')) {
        $expectedToken = MIGRATION_TOKEN;
    }
    
    // Fallback: If no token is configured, block remote execution
    if (empty($expectedToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Migration token is not configured on the server.']);
        exit;
    }

    $providedToken = isset($_GET['token']) ? $_GET['token'] : '';
    if (!hash_equals($expectedToken, $providedToken)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized migration attempt.']);
        exit;
    }
}

// Establish DB Connection
try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed: ' . $e->getMessage()]);
    exit(1);
}

class MigrationException extends RuntimeException {}

$applied = [];
$errors = [];

try {
    // 1. Ensure migration_history table exists
    $historySqlFile = __DIR__ . '/data/migrations/03_create_migration_history.sql';
    if (!file_exists($historySqlFile)) {
        throw new MigrationException("Core migration file 03_create_migration_history.sql is missing!");
    }
    
    $historySql = file_get_contents($historySqlFile);
    $pdo->exec($historySql);

    // 2. Fetch already applied migrations
    $stmt = $pdo->query("SELECT migration_name FROM migration_history");
    $appliedMigrations = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // 3. Scan migrations directory
    $migrationsDir = __DIR__ . '/data/migrations';
    $files = glob($migrationsDir . '/*.sql');
    sort($files); // Sort numerically/alphabetically

    foreach ($files as $file) {
        $fileName = basename($file);
        
        // Skip migration history creation sql itself since we already ran it
        if ($fileName === '03_create_migration_history.sql') {
            continue;
        }

        if (!in_array($fileName, $appliedMigrations)) {
            $sqlContent = file_get_contents($file);
            if (empty(trim($sqlContent))) {
                continue;
            }

            try {
                $pdo->beginTransaction();
                // Execute migration queries
                $pdo->exec($sqlContent);
                // Record execution
                $logStmt = $pdo->prepare("INSERT INTO migration_history (migration_name) VALUES (?)");
                $logStmt->execute([$fileName]);
                
                if ($pdo->inTransaction()) {
                    $pdo->commit();
                }
                
                $applied[] = $fileName;
            } catch (Exception $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                $errors[] = "Migration '$fileName' failed: " . $e->getMessage();
                break; // Stop running subsequent migrations on error
            }
        }
    }

} catch (Exception $e) {
    $errors[] = "Global migration manager error: " . $e->getMessage();
}

// Response output
$status = empty($errors);
$response = [
    'success' => $status,
    'applied' => $applied,
    'errors' => $errors
];

if (!$status) {
    http_response_code(500);
}

echo json_encode($response, JSON_PRETTY_PRINT);
if (!$status && $isCli) {
    exit(1);
}
exit(0);
