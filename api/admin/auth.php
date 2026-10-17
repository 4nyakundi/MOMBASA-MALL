<?php
require_once __DIR__ . '/../config.php';
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
if ($method === 'GET') {
    if (empty($_SESSION['admin_user'])) json_response(['success' => true, 'authenticated' => false]);
    $user = require_admin_auth();
    json_response(['success' => true, 'authenticated' => true, 'user' => $user, 'token' => $_SESSION['admin_token']]);
}
if ($method !== 'POST') json_response(['success' => false, 'error' => 'POST required'], 405);
if ($action === 'logout') {
    require_admin_auth();
    $_SESSION = [];
    $params = session_get_cookie_params();
    setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $params['path'], 'secure' => $params['secure'], 'httponly' => true, 'samesite' => 'Strict']);
    session_destroy();
    json_response(['success' => true]);
}
$input = get_json_input();
$pdo = get_db_connection();
if ($action === 'password') {
    $user = require_admin_auth();
    $stmt = $pdo->prepare('SELECT password_hash FROM admin_users WHERE id = ?');
    $stmt->execute([$user['id']]);
    if (!password_verify((string)($input['current_password'] ?? ''), $stmt->fetchColumn())) json_response(['success' => false, 'error' => 'Current password is incorrect.'], 403);
    $password = (string)($input['password'] ?? '');
    if (strlen($password) < 12) json_response(['success' => false, 'error' => 'Use at least 12 characters.'], 422);
    $pdo->prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
    session_regenerate_id(true);
    $_SESSION['admin_token'] = bin2hex(random_bytes(32));
    json_response(['success' => true, 'token' => $_SESSION['admin_token']]);
}
// Throttle failures across browser sessions by source IP.
$stmt = $pdo->prepare("SELECT COUNT(*) FROM activity_log WHERE action = 'login_failed' AND ip_address = ? AND performed_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)");
$stmt->execute([$_SERVER['REMOTE_ADDR'] ?? '']);
if ((int)$stmt->fetchColumn() >= 10) json_response(['success' => false, 'error' => 'Too many sign-in attempts. Try again in 15 minutes.'], 429);
$stmt = $pdo->prepare('SELECT * FROM admin_users WHERE email = ? AND is_active = 1 LIMIT 1');
$stmt->execute([strtolower(trim($input['email'] ?? ''))]);
$user = $stmt->fetch();
if (!$user || !password_verify((string)($input['password'] ?? ''), $user['password_hash'])) {
    log_activity($pdo, null, 'login_failed', 'admin_user', null);
    json_response(['success' => false, 'error' => 'Incorrect email or password.'], 401);
}
session_regenerate_id(true);
unset($user['password_hash']);
$_SESSION['admin_user'] = $user;
$_SESSION['last_seen'] = time();
$_SESSION['admin_token'] = bin2hex(random_bytes(32));
$pdo->prepare('UPDATE admin_users SET last_login = NOW() WHERE id = ?')->execute([$user['id']]);
log_activity($pdo, $user['id'], 'login', 'admin_user', $user['id']);
json_response(['success' => true, 'user' => $user, 'token' => $_SESSION['admin_token']]);
