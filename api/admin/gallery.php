<?php
/**
 * Mombasa Mall - Gallery API
 */

require_once __DIR__ . '/../config.php';

$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];

// Handle GET
if ($method === 'GET') {
    $category = $_GET['category'] ?? null;
    $sql = "SELECT * FROM gallery WHERE 1=1";
    $params = [];

    if ($category) {
        $sql .= " AND category = :category";
        $params[':category'] = $category;
    }

    $sql .= " ORDER BY sort_order ASC, uploaded_at DESC, id DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $items = $stmt->fetchAll();

    $formatted = [];
    foreach ($items as $g) {
        $formatted[] = [
            'id'          => (string)$g['id'],
            'numeric_id'  => (int)$g['id'],
            'title'       => $g['title'] ?: 'Mall Photo',
            'url'         => $g['image_url'],
            'image_url'   => $g['image_url'],
            'category'    => $g['category'] ?: 'General',
            'caption'     => $g['caption'] ?: '',
            'date'        => date('Y-m-d', strtotime($g['uploaded_at'])),
            'uploaded_at' => $g['uploaded_at']
        ];
    }

    json_response([
        'success' => true,
        'count'   => count($formatted),
        'gallery' => $formatted
    ]);
}

// Handle POST (Add Photo)
if ($method === 'POST') {
    $input = get_json_input();
    $imageUrl = trim($input['url'] ?? $input['image_url'] ?? '');
    if (empty($imageUrl)) {
        json_response(['success' => false, 'error' => 'Image URL is required'], 400);
    }

    $title = trim($input['title'] ?? 'Mall Showcase');
    $category = trim($input['category'] ?? 'General');
    $caption = trim($input['caption'] ?? '');
    $sortOrder = (int)($input['sort_order'] ?? 0);

    $stmt = $pdo->prepare("
        INSERT INTO gallery (title, image_url, category, caption, sort_order, uploaded_by)
        VALUES (:title, :image_url, :category, :caption, :sort_order, :uploaded_by)
    ");
    $stmt->execute([
        ':title'       => $title,
        ':image_url'   => $imageUrl,
        ':category'    => $category,
        ':caption'     => $caption,
        ':sort_order'  => $sortOrder,
        ':uploaded_by' => $_SESSION['admin_user']['id'] ?? 1
    ]);

    $photoId = (int)$pdo->lastInsertId();
    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'add_gallery', 'gallery', $photoId, "Added photo: {$title}");

    json_response([
        'success'  => true,
        'message'  => 'Photo added to gallery',
        'photo_id' => $photoId
    ], 201);
}

// Handle DELETE
if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        $input = get_json_input();
        $id = (int)($input['id'] ?? 0);
    }

    if ($id <= 0) {
        json_response(['success' => false, 'error' => 'Valid photo ID is required'], 400);
    }

    $stmt = $pdo->prepare("DELETE FROM gallery WHERE id = :id");
    $stmt->execute([':id' => $id]);

    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'delete_gallery', 'gallery', $id, "Deleted gallery photo ID: {$id}");

    json_response([
        'success' => true,
        'message' => 'Photo deleted from gallery'
    ]);
}

json_response(['success' => false, 'error' => 'Method not allowed'], 405);
