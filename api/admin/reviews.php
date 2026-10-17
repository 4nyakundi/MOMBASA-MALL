<?php
/**
 * Mombasa Mall - Reviews Moderation API
 */

require_once __DIR__ . '/../config.php';

authorize_resource('reviews');
$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];

// Handle GET
if ($method === 'GET') {
    $status = $_GET['status'] ?? null;
    $sql = "
        SELECT r.*, s.name AS store_name
        FROM reviews r
        LEFT JOIN stores s ON r.store_id = s.id
        WHERE 1=1
    ";
    $params = [];

    if ($status) {
        $sql .= " AND r.status = :status";
        $params[':status'] = $status;
    }

    $sql .= " ORDER BY r.submitted_at DESC, r.id DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $reviews = $stmt->fetchAll();

    $formatted = [];
    foreach ($reviews as $r) {
        $storeDisplay = $r['store_name'] ?: ($r['store_name_typed'] ?: 'Mombasa Mall');
        $formatted[] = [
            'id'           => (string)$r['id'],
            'numeric_id'   => (int)$r['id'],
            'author'       => $r['reviewer_name'],
            'name'         => $r['reviewer_name'],
            'reviewer_name'=> $r['reviewer_name'],
            'email'        => $r['reviewer_email'] ?: '',
            'quote'        => $r['review_text'],
            'comment'      => $r['review_text'],
            'review_text'  => $r['review_text'],
            'rating'       => (int)$r['rating'],
            'store'        => $storeDisplay,
            'store_id'     => $r['store_id'],
            'status'       => $r['status'],
            'approved'     => $r['status'] === 'approved',
            'type'         => metadata_get($pdo, 'reviews', $r['id'])['reviewType'] ?? (stripos($r['admin_notes'] ?? '', 'testimonial') !== false ? 'testimonial' : 'feedback'),
            'date'         => date('M d, Y', strtotime($r['submitted_at'])),
            'submitted_at' => $r['submitted_at']
        ];
    }

    if (defined('MALL_PUBLIC_READ')) {
        foreach ($formatted as &$item) { unset($item['email'], $item['reviewer_email']); }
        unset($item);
    }
    json_response([
        'success' => true,
        'count'   => count($formatted),
        'reviews' => $formatted
    ]);
}

// Handle PUT (Approve / Reject / Update)
if ($method === 'PUT') {
    $input = get_json_input();
    $id = (int)($input['numeric_id'] ?? $input['id'] ?? 0);
    if ($id <= 0) {
        json_response(['success' => false, 'error' => 'Valid review ID is required'], 400);
    }
    require_existing($pdo, 'reviews', $id);

    $status = $input['status'] ?? null;
    if (isset($input['approved'])) {
        $status = $input['approved'] ? 'approved' : 'rejected';
    }

    if (!in_array($status, ['pending', 'approved', 'rejected'])) {
        json_response(['success' => false, 'error' => 'Invalid review status.'], 422);
    }

    $adminNotes = $input['admin_notes'] ?? null;

    $stmt = $pdo->prepare("
        UPDATE reviews SET
            status = :status,
            admin_notes = COALESCE(:notes, admin_notes)
        WHERE id = :id
    ");
    $stmt->execute([
        ':status' => $status,
        ':notes'  => $adminNotes,
        ':id'     => $id
    ]);

    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'moderate_review', 'review', $id, "Updated review status to: {$status}");

    json_response([
        'success' => true,
        'message' => "Review {$status} successfully"
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
        json_response(['success' => false, 'error' => 'Valid review ID is required'], 400);
    }
    require_existing($pdo, 'reviews', $id);

    $stmt = $pdo->prepare("DELETE FROM reviews WHERE id = :id");
    $stmt->execute([':id' => $id]);

    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'delete_review', 'review', $id, "Deleted review ID: {$id}");

    json_response([
        'success' => true,
        'message' => 'Review deleted successfully'
    ]);
}

json_response(['success' => false, 'error' => 'Method not allowed'], 405);
