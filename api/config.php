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

// Enable CORS and define JSON headers
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');
} else {
    header('Access-Control-Allow-Origin: *');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'])) {
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    }
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])) {
        header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
    }
    http_response_code(204);
    exit(0);
}

header('Content-Type: application/json; charset=UTF-8');

// Start secure session if not started
if (session_status() === PHP_SESSION_NONE) {
    // Configurable session lifetime (14 days)
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_only_cookies', 1);
    session_start();
}

// Database Credentials
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'mombasam_mall');
define('DB_USER', getenv('DB_USER') ?: 'mombasam_admall');
define('DB_PASS', getenv('DB_PASS') !== false ? getenv('DB_PASS') : '@dmin26PHP');
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

    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET . " COLLATE utf8mb4_unicode_ci"
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error'   => 'Database connection failed: ' . $e->getMessage()
        ]);
        exit();
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
    return is_array($decoded) ? $decoded : [];
}

/**
 * Validate admin session or token
 */
function require_admin_auth() {
    if (!empty($_SESSION['admin_user'])) {
        return $_SESSION['admin_user'];
    }

    // Optional Bearer header validation if sent via API token
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!empty($authHeader) && preg_match('/Bearer\s+(\S+)/', $authHeader, $matches)) {
        $token = $matches[1];
        if (!empty($_SESSION['admin_token']) && hash_equals($_SESSION['admin_token'], $token)) {
            return $_SESSION['admin_user'];
        }
    }

    // Allow read requests or authenticate for writes
    return null;
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
