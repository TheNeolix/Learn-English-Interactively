<?php
// Secure session setup with 30-day cookie persistence
ini_set('session.cookie_lifetime', 60 * 60 * 24 * 30);
ini_set('session.gc_maxlifetime', 60 * 60 * 24 * 30);

$isSecure = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on')
    || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

session_start([
    'cookie_lifetime' => 60 * 60 * 24 * 30,
    'cookie_path' => '/',
    'cookie_secure' => $isSecure,
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax'
]);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
header('Strict-Transport-Security: max-age=31536000; includeSubDomains');

// Include database configuration
if (!file_exists(__DIR__ . '/db_config.php')) {
    echo json_encode(['error' => 'Database configuration file is missing. Please create db_config.php.']);
    exit;
}
require_once __DIR__ . '/db_config.php';

// Define password validation constants
if (!defined('PASSWORD_REGEX')) {
    define('PASSWORD_REGEX', '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/');
    define('PASSWORD_ERR_MSG', 'A jelszónak legalább 8 karakterből kell állnia, és tartalmaznia kell kisbetűt, nagybetűt, számot és speciális karaktert!');
}

// Initialize Database Connection
try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);
} catch (PDOException $e) {
    error_log('Database connection failed: ' . $e->getMessage());
    echo json_encode(['error' => 'Hiba történt az adatbázis csatlakozás során.']);
    exit;
}

// Read JSON input payloads (from POST requests)
$inputData = [];
$rawInput = file_get_contents('php://input');
if (!empty($rawInput)) {
    $decoded = json_decode($rawInput, true);
    if (is_array($decoded)) {
        $inputData = $decoded;
    }
}

// Router
$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'signup':
        handleSignup($pdo, $inputData);
        break;

    case 'verify_email':
        handleVerifyEmail($pdo, $inputData);
        break;

    case 'login':
        handleLogin($pdo, $inputData);
        break;

    case 'logout':
        handleLogout();
        break;

    case 'get_session':
        handleGetSession($pdo);
        break;

    case 'save_progress':
        handleSaveProgress($pdo, $inputData);
        break;

    case 'update_password':
        handleUpdatePassword($pdo, $inputData);
        break;

    case 'forgot_password':
        handleForgotPassword($pdo, $inputData);
        break;

    case 'reset_password':
        handleResetPassword($pdo, $inputData);
        break;

    default:
        echo json_encode(['error' => 'Invalid action']);
        break;
}

// --- API ACTIONS HANDLERS ---

// 1. Sign Up
function validateSignupData($pdo, $email, $password, $username)
{
    if (empty($email) || empty($password) || empty($username)) {
        return 'Minden mező kitöltése kötelező (felhasználónév, e-mail, jelszó)!';
    }
    if (mb_strlen($username) > 50) {
        return 'A felhasználónév maximum 50 karakter hosszú lehet!';
    }
    if (mb_strlen($email) > 100) {
        return 'Az e-mail cím maximum 100 karakter hosszú lehet!';
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return 'Érvénytelen e-mail cím formátum!';
    }
    if (!preg_match(PASSWORD_REGEX, $password)) {
        return PASSWORD_ERR_MSG;
    }
    // Check if email already exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        return 'Ez az e-mail cím már regisztrálva van!';
    }
    // Check if username already exists
    $stmtUser = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $stmtUser->execute([$username]);
    if ($stmtUser->fetch()) {
        return 'Ez a felhasználónév már foglalt!';
    }
    return null;
}

function handleSignup($pdo, $data)
{
    $email = isset($data['email']) ? trim($data['email']) : '';
    $password = isset($data['password']) ? $data['password'] : '';
    $username = isset($data['username']) ? trim($data['username']) : '';
    $ageRange = isset($data['age_range']) ? trim($data['age_range']) : 'unknown';
    $guestMigration = isset($data['guest_migration']) ? $data['guest_migration'] : [];

    try {
        $validationError = validateSignupData($pdo, $email, $password, $username);
        if ($validationError) {
            echo json_encode(['error' => $validationError]);
            return;
        }

        // Insert new user
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $verificationToken = bin2hex(random_bytes(32));
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("INSERT INTO users (email, password_hash, username, age_range, is_verified, verification_token) VALUES (?, ?, ?, ?, 0, ?)");
        $stmt->execute([$email, $passwordHash, $username, $ageRange, $verificationToken]);
        $userId = $pdo->lastInsertId();

        // Migrate guest progress data if available
        $points = isset($guestMigration['points']) ? intval($guestMigration['points']) : 0;
        $completed = isset($guestMigration['completed']) ? json_encode($guestMigration['completed']) : json_encode(new stdClass());
        $scores = isset($guestMigration['scores']) ? json_encode($guestMigration['scores']) : json_encode(new stdClass());

        // Create user_progress (with default gamification values)
        $stmtProgress = $pdo->prepare("INSERT INTO user_progress 
            (user_id, points, completed, scores, level, streak_count, streak_shields, active_theme) 
            VALUES (?, ?, ?, ?, 1, 0, 2, 'default')");
        $stmtProgress->execute([$userId, $points, $completed, $scores]);

        // Create default free subscription
        $stmtSub = $pdo->prepare("INSERT INTO user_subscriptions (user_id, role, subscription_tier) VALUES (?, 'user', 'free')");
        $stmtSub->execute([$userId]);

        $pdo->commit();

        // Send verification email
        try {
            require_once __DIR__ . '/lib/Mailer.php';
            $mailer = new Mailer();
            $mailer->sendVerificationEmail($email, htmlspecialchars($username, ENT_QUOTES, 'UTF-8'), $verificationToken);
        } catch (Exception $mailEx) {
            // Log but don't fail registration
            error_log('Failed to send verification email: ' . $mailEx->getMessage());
        }

        // Establish PHP session right away (direct sign-up)
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;
        $_SESSION['username'] = $username;
        $_SESSION['email'] = $email;

        echo json_encode([
            'success' => true,
            'user' => [
                'id' => $userId,
                'email' => $email,
                'username' => htmlspecialchars($username, ENT_QUOTES, 'UTF-8'),
                'age_range' => $ageRange
            ]
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('Registration error: ' . $e->getMessage());
        echo json_encode(['error' => 'Hiba történt a regisztráció során. Kérjük, próbáld újra később.']);
    }
}

function handleVerifyEmail($pdo, $data)
{
    $token = '';
    if (isset($data['token'])) {
        $token = trim($data['token']);
    } elseif (isset($_GET['token'])) {
        $token = trim($_GET['token']);
    }

    if (empty($token)) {
        echo json_encode(['error' => 'Hiányzó megerősítő kód.']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT id FROM users WHERE verification_token = ?");
        $stmt->execute([$token]);
        $user = $stmt->fetch();

        if (!$user) {
            echo json_encode(['error' => 'Érvénytelen vagy már felhasznált megerősítő kód.']);
            return;
        }

        $updateStmt = $pdo->prepare("UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?");
        $updateStmt->execute([$user['id']]);

        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        error_log('Verification error: ' . $e->getMessage());
        echo json_encode(['error' => 'Hiba történt a megerősítés során.']);
    }
}

// 2. Log In
function handleLogin($pdo, $data)
{
    $email = isset($data['email']) ? trim($data['email']) : '';
    $password = isset($data['password']) ? $data['password'] : '';

    if (empty($email) || empty($password)) {
        echo json_encode(['error' => 'Add meg az e-mail címed és a jelszavad!']);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            SELECT u.id, u.email, u.password_hash, u.username, u.age_range, u.is_verified, s.role
            FROM users u
            LEFT JOIN user_subscriptions s ON u.id = s.user_id
            WHERE u.email = ?
        ");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            echo json_encode(['error' => 'Hibás e-mail cím vagy jelszó!']);
            return;
        }

        // Establish session
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['email'] = $user['email'];

        echo json_encode([
            'success' => true,
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'username' => htmlspecialchars($user['username'], ENT_QUOTES, 'UTF-8'),
                'age_range' => $user['age_range'],
                'is_verified' => (bool)$user['is_verified'],
                'role' => isset($user['role']) ? $user['role'] : 'user'
            ]
        ]);
    } catch (Exception $e) {
        error_log('Login error: ' . $e->getMessage());
        echo json_encode(['error' => 'Hiba történt a bejelentkezés során. Kérjük, próbáld újra később.']);
    }
}

// 3. Log Out
function handleLogout()
{
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params["path"],
            $params["domain"],
            $params["secure"],
            $params["httponly"]
        );
    }
    session_destroy();
    echo json_encode(['success' => true]);
}

// 4. Get Current Session State (Retrieves user data + progress details)
function formatUserProgress($progress)
{
    if (!$progress) {
        return [
            'points' => 0,
            'completed' => new stdClass(),
            'scores' => new stdClass(),
            'level' => 1,
            'streak_count' => 0,
            'streak_shields' => 2,
            'last_active_date' => null,
            'unlocked_items' => [],
            'active_theme' => 'default',
            'earned_xp_per_node' => new stdClass(),
            'daily_quests_date' => null,
            'active_quests' => [],
            'quest_progress' => new stdClass(),
            'completed_quests_today' => []
        ];
    }
    return [
        'points' => intval($progress['points']),
        'completed' => !empty($progress['completed']) ? json_decode($progress['completed']) : new stdClass(),
        'scores' => !empty($progress['scores']) ? json_decode($progress['scores']) : new stdClass(),
        'level' => intval($progress['level']),
        'streak_count' => intval($progress['streak_count']),
        'streak_shields' => intval($progress['streak_shields']),
        'last_active_date' => $progress['last_active_date'],
        'unlocked_items' => !empty($progress['unlocked_items']) ? json_decode($progress['unlocked_items']) : [],
        'active_theme' => $progress['active_theme'],
        'earned_xp_per_node' => !empty($progress['earned_xp_per_node']) ? json_decode($progress['earned_xp_per_node']) : new stdClass(),
        'daily_quests_date' => $progress['daily_quests_date'],
        'active_quests' => !empty($progress['active_quests']) ? json_decode($progress['active_quests']) : [],
        'quest_progress' => !empty($progress['quest_progress']) ? json_decode($progress['quest_progress']) : new stdClass(),
        'completed_quests_today' => !empty($progress['completed_quests_today']) ? json_decode($progress['completed_quests_today']) : []
    ];
}

// 4. Get Current Session State (Retrieves user data + progress details)
function handleGetSession($pdo)
{
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['session' => null]);
        return;
    }

    $userId = $_SESSION['user_id'];

    try {
        // Load User main details
        $stmtUser = $pdo->prepare("SELECT email, username, age_range, is_verified FROM users WHERE id = ?");
        $stmtUser->execute([$userId]);
        $user = $stmtUser->fetch();

        if (!$user) {
            // Clean up invalid session
            session_destroy();
            echo json_encode(['session' => null]);
            return;
        }

        // Load progress details
        $stmtProgress = $pdo->prepare("SELECT points, completed, scores, level, streak_count, streak_shields, last_active_date, unlocked_items, active_theme, earned_xp_per_node, daily_quests_date, active_quests, quest_progress, completed_quests_today FROM user_progress WHERE user_id = ?");
        $stmtProgress->execute([$userId]);
        $progress = $stmtProgress->fetch();

        // Load subscription details
        $stmtSub = $pdo->prepare("SELECT role, subscription_tier FROM user_subscriptions WHERE user_id = ?");
        $stmtSub->execute([$userId]);
        $sub = $stmtSub->fetch();

        echo json_encode(
            [
                'session' => [
                    'user' => [
                        'id' => $userId,
                        'email' => $user['email'],
                        'user_metadata' => [
                            'username' => htmlspecialchars($user['username'], ENT_QUOTES, 'UTF-8'),
                            'age_range' => $user['age_range'],
                            'is_verified' => (bool)$user['is_verified'],
                            'role' => $sub ? $sub['role'] : 'user'
                        ]
                    ]
                ],
                'progress' => formatUserProgress($progress),
                'subscription' => [
                    'role' => $sub ? $sub['role'] : 'user',
                    'subscription_tier' => $sub ? $sub['subscription_tier'] : 'free'
                ]
            ]
        );
    } catch (Exception $e) {
        error_log('Session load error: ' . $e->getMessage());
        echo json_encode(['error' => 'Hiba a munkamenet betöltésekor. Kérjük, próbáld újra később.']);
    }
}

function parseProgressData($data)
{
    return [
        'points' => isset($data['points']) ? intval($data['points']) : 0,
        'completed' => isset($data['completed']) ? json_encode($data['completed']) : json_encode(new stdClass()),
        'scores' => isset($data['scores']) ? json_encode($data['scores']) : json_encode(new stdClass()),
        'level' => isset($data['level']) ? intval($data['level']) : 1,
        'streak_count' => isset($data['streak_count']) ? intval($data['streak_count']) : 0,
        'streak_shields' => isset($data['streak_shields']) ? intval($data['streak_shields']) : 2,
        'last_active_date' => !empty($data['last_active_date']) ? $data['last_active_date'] : null,
        'unlocked_items' => isset($data['unlocked_items']) ? json_encode($data['unlocked_items']) : json_encode([]),
        'active_theme' => !empty($data['active_theme']) ? $data['active_theme'] : 'default',
        'earned_xp_per_node' => isset($data['earned_xp_per_node']) ? json_encode($data['earned_xp_per_node']) : json_encode(new stdClass()),
        'daily_quests_date' => !empty($data['daily_quests_date']) ? $data['daily_quests_date'] : null,
        'active_quests' => isset($data['active_quests']) ? json_encode($data['active_quests']) : json_encode([]),
        'quest_progress' => isset($data['quest_progress']) ? json_encode($data['quest_progress']) : json_encode(new stdClass()),
        'completed_quests_today' => isset($data['completed_quests_today']) ? json_encode($data['completed_quests_today']) : json_encode([])
    ];
}

// 5. Save Progress
function handleSaveProgress($pdo, $data)
{
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['error' => 'Munkamenet lejárt! Kérjük, jelentkezz be újra.']);
        return;
    }

    $userId = $_SESSION['user_id'];
    $parsed = parseProgressData($data);

    try {
        $stmt = $pdo->prepare("INSERT INTO user_progress 
            (user_id, points, completed, scores, level, streak_count, streak_shields, last_active_date, unlocked_items, active_theme, earned_xp_per_node, daily_quests_date, active_quests, quest_progress, completed_quests_today) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE 
            points = VALUES(points), 
            completed = VALUES(completed), 
            scores = VALUES(scores),
            level = VALUES(level),
            streak_count = VALUES(streak_count),
            streak_shields = VALUES(streak_shields),
            last_active_date = VALUES(last_active_date),
            unlocked_items = VALUES(unlocked_items),
            active_theme = VALUES(active_theme),
            earned_xp_per_node = VALUES(earned_xp_per_node),
            daily_quests_date = VALUES(daily_quests_date),
            active_quests = VALUES(active_quests),
            quest_progress = VALUES(quest_progress),
            completed_quests_today = VALUES(completed_quests_today)");

        $stmt->execute([
            $userId,
            $parsed['points'],
            $parsed['completed'],
            $parsed['scores'],
            $parsed['level'],
            $parsed['streak_count'],
            $parsed['streak_shields'],
            $parsed['last_active_date'],
            $parsed['unlocked_items'],
            $parsed['active_theme'],
            $parsed['earned_xp_per_node'],
            $parsed['daily_quests_date'],
            $parsed['active_quests'],
            $parsed['quest_progress'],
            $parsed['completed_quests_today']
        ]);

        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        error_log('Progress save error: ' . $e->getMessage());
        echo json_encode(['error' => 'Hiba a mentés során. Kérjük, próbáld újra később.']);
    }
}

function validatePasswordUpdate($currentPassword, $newPassword)
{
    if (empty($currentPassword) || empty($newPassword)) {
        return 'A jelenlegi és az új jelszót is meg kell adni!';
    }
    if (!preg_match(PASSWORD_REGEX, $newPassword)) {
        return PASSWORD_ERR_MSG;
    }
    return null;
}

function handleUpdatePassword($pdo, $data)
{
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['error' => 'Munkamenet lejárt! Kérjük, jelentkezz be újra.']);
        return;
    }
    
    $userId = $_SESSION['user_id'];
    $currentPassword = isset($data['current_password']) ? $data['current_password'] : '';
    $newPassword = isset($data['new_password']) ? $data['new_password'] : '';

    $error = validatePasswordUpdate($currentPassword, $newPassword);
    if ($error) {
        echo json_encode(['error' => $error]);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($currentPassword, $user['password_hash'])) {
            echo json_encode(['error' => 'A jelenlegi jelszó helytelen!']);
            return;
        }

        $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $stmtUpdate = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        $stmtUpdate->execute([$newHash, $userId]);

        echo json_encode(['success' => true, 'message' => 'A jelszó sikeresen megváltoztatva! Most már bejelentkezhetsz.']);
    } catch (Exception $e) {
        error_log('Update password error: ' . $e->getMessage());
        echo json_encode(['error' => 'Hiba történt a jelszó módosítása során.']);
    }
}

// 7. Request Forgot Password (generates token and mails it)
function handleForgotPassword($pdo, $data)
{
    $email = isset($data['email']) ? trim($data['email']) : '';

    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['error' => 'Adj meg egy érvényes e-mail címet!']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT id, username FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user) {
            // Security best practice: don't explicitly say "email does not exist"
            // to avoid email harvesting, just return success.
            echo json_encode(['success' => true, 'message' => 'Ha az e-mail cím létezik a rendszerünkben, kiküldtük a visszaállítási linket.']);
            return;
        }

        // Generate token and expiry (1 hour)
        $token = bin2hex(random_bytes(32));
        $expiry = date('Y-m-d H:i:s', time() + 3600);

        // Update database with token
        $stmtUpdate = $pdo->prepare("UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?");
        $stmtUpdate->execute([$token, $expiry, $user['id']]);

        // Construct reset link
        $allowedHosts = ['neolix.studio'];
        $host = isset($_SERVER['HTTP_HOST']) && in_array($_SERVER['HTTP_HOST'], $allowedHosts, true) ? $_SERVER['HTTP_HOST'] : 'neolix.studio';
        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
        $resetLink = $protocol . "://" . $host . "/index.html?action=reset_password&token=" . $token;

        // Email details
        $to = $email;
        $subject = "Jelszo visszaallitasa - Neolix Studio";

        $message = "Szia " . htmlspecialchars($user['username']) . "!\r\n\r\n" .
            "Jelszo-visszaallitasi kerelem erkezett a fiokodhoz.\r\n" .
            "Kérjük, kattints az alabbi linkre a jelszavad megvaltoztatasahoz:\r\n\r\n" .
            $resetLink . "\r\n\r\n" .
            "Ez a link 1 oraig ervenyes.\r\n" .
            "Ha nem te kerted a jelszo visszaallitasat, hagyd figyelmen kivul ezt az e-mailt.\r\n\r\n" .
            "Udvozlettel,\r\nNeolix Studio";

        $headers = "From: no-reply@neolix.studio\r\n" .
            "Reply-To: no-reply@neolix.studio\r\n" .
            "Content-Type: text/plain; charset=UTF-8\r\n" .
            "X-Mailer: PHP/" . phpversion();

        // Send email
        if (mail($to, $subject, $message, $headers)) {
            echo json_encode(['success' => true, 'message' => 'Ha az e-mail cím létezik a rendszerünkben, kiküldtük a visszaállítási linket.']);
        } else {
            echo json_encode(['error' => 'Nem sikerült elküldeni az e-mailt. Kérjük, próbáld meg később.']);
        }
    } catch (Exception $e) {
        error_log('Forgot password error: ' . $e->getMessage());
        echo json_encode(['error' => 'Hiba történt a kérelem feldolgozása során. Kérjük, próbáld újra később.']);
    }
}

// 8. Execute Reset Password via Token
function handleResetPassword($pdo, $data)
{
    $token = isset($data['token']) ? trim($data['token']) : '';
    $newPassword = isset($data['password']) ? $data['password'] : '';

    if (empty($token)) {
        echo json_encode(['error' => 'Hiányzó vagy érvénytelen visszaállítási token!']);
        return;
    }

    if (empty($newPassword) || !preg_match(PASSWORD_REGEX, $newPassword)) {
        echo json_encode(['error' => PASSWORD_ERR_MSG]);
        return;
    }

    try {
        // Find token and check expiry
        $stmt = $pdo->prepare("SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()");
        $stmt->execute([$token]);
        $user = $stmt->fetch();

        if (!$user) {
            echo json_encode(['error' => 'A jelszó-visszaállítási link érvénytelen vagy már lejárt!']);
            return;
        }

        // Update password and clear token
        $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $stmtUpdate = $pdo->prepare("UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?");
        $stmtUpdate->execute([$passwordHash, $user['id']]);

        echo json_encode(['success' => true, 'message' => 'A jelszó sikeresen megváltoztatva! Most már bejelentkezhetsz.']);
    } catch (Exception $e) {
        error_log('Reset password error: ' . $e->getMessage());
        echo json_encode(['error' => 'Hiba történt a jelszó visszaállítása során. Kérjük, próbáld újra később.']);
    }
}
