<?php
/**
 * Mombasa Mall - Admin Users & Roles API
 * CRUD management for admin_users table
 */

require_once __DIR__ . '/../config.php';

$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];

// Handle GET
if ($method === 'GET') {
    $stmt = $pdo->query("SELECT id, full_name, email, phone, role, is_active, last_login, created_at FROM admin_users ORDER BY id ASC");
    $users = $stmt->fetchAll();

    $formatted = [];
    foreach ($users as $u) {
        $formatted[] = [
            'id'         => (string)$u['id'],
            'numeric_id' => (int)$u['id'],
            'name'       => $u['full_name'],
            'full_name'  => $u['full_name'],
            'email'      => $u['email'],
            'phone'      => $u['phone'] ?: '+254 790 964 002',
            'role'       => $u['role'],
            'status'     => $u['is_active'] ? 'active' : 'inactive',
            'is_active'  => (bool)$u['is_active'],
            'lastLogin'  => $u['last_login'] ? date('M d, Y H:i', strtotime($u['last_login'])) : 'Never',
            'created_at' => $u['created_at']
        ];
    }

    json_response([
        'success' => true,
        'count'   => count($formatted),
        'users'   => $formatted
    ]);
}

// Handle POST (Create User)
if ($method === 'POST') {
    $input = get_json_input();
    $name = trim($input['name'] ?? $input['full_name'] ?? '');
    $email = strtolower(trim($input['email'] ?? ''));
    $password = (string)($input['password'] ?? '');
    $role = strtolower(trim($input['role'] ?? 'editor'));
    $phone = trim($input['phone'] ?? '+254 790 964 002');
    $status = ($input['status'] ?? 'active') === 'inactive' ? 0 : 1;

    if (empty($name) || empty($email)) {
        json_response(['success' => false, 'error' => 'Full name and email are required'], 400);
    }

    if (empty($password)) {
        $password = '@dmin26PHP'; // Default initial password
    }

    if (!in_array($role, ['superadmin', 'admin', 'editor', 'moderator'])) {
        $role = 'editor';
    }

    // Check email uniqueness
    $check = $pdo->prepare("SELECT id FROM admin_users WHERE email = :email");
    $check->execute([':email' => $email]);
    if ($check->fetch()) {
        json_response(['success' => false, 'error' => 'A user with this email already exists'], 409);
    }

    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    $stmt = $pdo->prepare("
        INSERT INTO admin_users (full_name, email, password_hash, phone, role, is_active)
        VALUES (:name, :email, :hash, :phone, :role, :status)
    ");
    $stmt->execute([
        ':name'   => $name,
        ':email'  => $email,
        ':hash'   => $hash,
        ':phone'  => $phone,
        ':role'   => $role,
        ':status' => $status
    ]);

    $userId = (int)$pdo->lastInsertId();
    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'create_user', 'admin_user', $userId, "Created user: {$email}");

    json_response([
        'success' => true,
        'message' => 'User created successfully',
        'user_id' => $userId
    ], 201);
}

// Handle PUT (Update User)
if ($method === 'PUT') {
    $input = get_json_input();
    $id = (int)($input['numeric_id'] ?? $input['id'] ?? 0);
    if ($id <= 0) {
        json_response(['success' => false, 'error' => 'Valid user ID is required'], 400);
    }

    $name = trim($input['name'] ?? $input['full_name'] ?? '');
    $email = strtolower(trim($input['email'] ?? ''));
    $role = strtolower(trim($input['role'] ?? ''));
    $phone = trim($input['phone'] ?? '');
    $status = isset($input['status']) ? ($input['status'] === 'inactive' ? 0 : 1) : null;
    $password = trim($input['password'] ?? '');

    $sql = "UPDATE admin_users SET full_name = :name, email = :email";
    $params = [':name' => $name, ':email' => $email, ':id' => $id];

    if (!empty($role) && in_array($role, ['superadmin', 'admin', 'editor', 'moderator'])) {
        $sql .= ", role = :role";
        $params[':role'] = $role;
    }
    if (!empty($phone)) {
        $sql .= ", phone = :phone";
        $params[':phone'] = $phone;
    }
    if ($status !== null) {
        $sql .= ", is_active = :status";
        $params[':status'] = $status;
    }
    if (!empty($password)) {
        $sql .= ", password_hash = :hash";
        $params[':hash'] = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    $sql .= " WHERE id = :id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'update_user', 'admin_user', $id, "Updated user ID: {$id}");

    json_response([
        'success' => true,
        'message' => 'User updated successfully'
    ]);
}

// Handle DELETE
if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        $input = get_json_input();
        $id = (int)($input['id'] ?? 0);
    }

    if ($id <= 0) {
        json_response(['success' => false, 'error' => 'Valid user ID is required'], 400);
    }

    // Safety guard: cannot delete user 1 (superadmin)
    if ($id === 1) {
        json_response(['success' => false, 'error' => 'The primary Super Administrator account cannot be deleted'], 403);
    }

    $stmt = $pdo->prepare("DELETE FROM admin_users WHERE id = :id");
    $stmt->execute([':id' => $id]);

    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'delete_user', 'admin_user', $id, "Deleted user ID: {$id}");

    json_response([
        'success' => true,
        'message' => 'User deleted successfully'
    ]);
}

json_response(['success' => false, 'error' => 'Method not allowed'], 405);
