<?php
/**
 * Mombasa Mall - Database & API Core Configuration
 * Target Environment : cPanel (PHP 7.4+ / 8.x + MySQL / MariaDB)
 * Database Name      : mombasam_mall
 * Database User      : mombasam_admall
 */

// Report errors in development, suppress display in production
ini_set('display_errors', '0');
error_reporting(E_ALL);
require_once __DIR__ . '/bootstrap.php';
set_exception_handler(function ($error) {
    error_log((string)$error);
    [$status, $body] = mall_error_response($error);
    json_response($body, $status);
});

// API requests are same-origin; never reflect arbitrary credentialed origins.
$secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$expected = ($secure ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'localhost');
if ($origin !== '' && $origin !== $expected) { http_response_code(403); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
date_default_timezone_set('Africa/Nairobi');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('Content-Type: application/json; charset=UTF-8');

// Start secure session if not started
if (session_status() === PHP_SESSION_NONE) {
    // Configurable session lifetime (14 days)
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_only_cookies', 1);
    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params(['httponly' => true, 'secure' => $secure, 'samesite' => 'Strict', 'path' => '/']);
    session_start();
}

// Environment variables take precedence over the private cPanel settings file.
$databaseSettings = load_database_settings();
define('DB_HOST', $databaseSettings['DB_HOST']);
define('DB_PORT', $databaseSettings['DB_PORT']);
define('DB_NAME', $databaseSettings['DB_NAME']);
define('DB_USER', $databaseSettings['DB_USER']);
define('DB_PASS', $databaseSettings['DB_PASS'] ?? '');
define('DB_CONFIGURED', $databaseSettings['DB_PASS'] !== null && !in_array($databaseSettings['DB_PASS'], ['REPLACE_WITH_DATABASE_PASSWORD', 'CHANGE_ME'], true));
unset($databaseSettings);
define('DB_CHARSET', 'utf8mb4');

/**
 * Get PDO Database Connection
 * @return PDO
 */
function get_db_connection() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    if (!DB_CONFIGURED) throw new MallServiceException('database_not_configured', 'Online forms are temporarily unavailable because the website database connection is not configured. Please contact the mall team.');
    if (!extension_loaded('pdo_mysql')) throw new MallServiceException('database_driver_missing', 'Online forms are temporarily unavailable because the server database driver needs attention. Please contact the mall team.');
    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET . " COLLATE utf8mb4_unicode_ci"
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        $pdo->exec("SET time_zone = '+03:00'");
        return $pdo;
    } catch (PDOException $e) {
        error_log((string)$e);
        throw new MallServiceException('database_unavailable', 'Online forms cannot reach the website database at the moment. Please try again or contact the mall team.');
    }
}

/**
 * Return JSON response and exit
 */
function json_response($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * Parse incoming JSON input payload
 */
function get_json_input() {
    $raw = file_get_contents('php://input');
    if (empty($raw)) {
        return $_POST;
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) json_response(['success' => false, 'error' => 'Invalid JSON.'], 400);
    return $decoded;
}

/**
 * Validate admin session or token
 */
function require_admin_auth() {
    $id = $_SESSION['admin_user']['id'] ?? 0;
    if (!$id || time() - ($_SESSION['last_seen'] ?? 0) > 43200) json_response(['success' => false, 'error' => 'Please sign in.'], 401);
    $stmt = get_db_connection()->prepare('SELECT id, full_name, email, phone, role, is_active FROM admin_users WHERE id = ? AND is_active = 1');
    $stmt->execute([$id]);
    $user = $stmt->fetch();
    if (!$user) { $_SESSION = []; json_response(['success' => false, 'error' => 'Account inactive.'], 401); }
    $_SESSION['admin_user'] = $user;
    $_SESSION['last_seen'] = time();
    if ($_SERVER['REQUEST_METHOD'] !== 'GET' && (empty($_SERVER['HTTP_X_CSRF_TOKEN']) || !hash_equals($_SESSION['admin_token'] ?? '', $_SERVER['HTTP_X_CSRF_TOKEN']))) {
        json_response(['success' => false, 'error' => 'Session expired. Sign in again.'], 403);
    }
    return $user;
}
function authorize_resource($resource) {
    if (defined('MALL_PUBLIC_READ') && MALL_PUBLIC_READ && $_SERVER['REQUEST_METHOD'] === 'GET') return null;
    $user = require_admin_auth();
    $permissions = [
        'superadmin' => ['stores','events','blog','gallery','reviews','leads','users','dashboard','upload','backup'],
        'admin' => ['stores','events','blog','gallery','reviews','leads','dashboard','upload','backup'],
        'editor' => ['stores','events','blog','gallery','dashboard','upload'],
        'moderator' => ['reviews','leads','dashboard']
    ];
    if (!in_array($resource, $permissions[$user['role']] ?? [], true)) json_response(['success' => false, 'error' => 'Permission denied.'], 403);
    return $user;
}

/**
 * Audit log helper
 */
function log_activity($pdo, $adminId, $action, $entityType, $entityId, $details = null) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO activity_log (admin_id, action, entity_type, entity_id, details, ip_address)
            VALUES (:admin_id, :action, :entity_type, :entity_id, :details, :ip)
        ");
        $stmt->execute([
            ':admin_id'    => $adminId,
            ':action'      => $action,
            ':entity_type' => $entityType,
            ':entity_id'   => $entityId,
            ':details'     => is_array($details) ? json_encode($details) : (string)$details,
            ':ip'          => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
        ]);
    } catch (Exception $e) {
        // Silently continue if audit logging fails
    }
}

require_once __DIR__ . '/contracts.php';
