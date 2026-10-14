<?php
/**
 * Mombasa Mall - Events API
 */

require_once __DIR__ . '/../config.php';

$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];

// Handle GET
if ($method === 'GET') {
    $status = $_GET['status'] ?? null;
    $sql = "SELECT * FROM events WHERE 1=1";
    $params = [];

    if ($status) {
        $sql .= " AND status = :status";
        $params[':status'] = $status;
    }

    $sql .= " ORDER BY event_date DESC, id DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $events = $stmt->fetchAll();

    $formatted = [];
    foreach ($events as $e) {
        $eDate = $e['event_date'] ? date('Y-m-d', strtotime($e['event_date'])) : '';
        $eTime = $e['event_date'] ? date('H:i', strtotime($e['event_date'])) : '';
        $formatted[] = [
            'id'             => (string)$e['id'],
            'numeric_id'     => (int)$e['id'],
            'title'          => $e['title'],
            'venue'          => $e['venue'] ?: 'Mombasa Mall',
            'date'           => $eDate,
            'time'           => $eTime,
            'event_date'     => $e['event_date'],
            'event_end_date' => $e['event_end_date'],
            'description'    => $e['description'] ?: '',
            'imageUrl'       => $e['image_url'] ?: '',
            'image_url'      => $e['image_url'] ?: '',
            'status'         => $e['status'],
            'type'           => $e['status'] === 'past' ? 'past' : 'upcoming'
        ];
    }

    json_response([
        'success' => true,
        'count'   => count($formatted),
        'events'  => $formatted
    ]);
}

// Handle POST (Create)
if ($method === 'POST') {
    $input = get_json_input();
    $title = trim($input['title'] ?? '');
    if (empty($title)) {
        json_response(['success' => false, 'error' => 'Event title is required'], 400);
    }

    $venue = trim($input['venue'] ?? 'Mombasa Mall');
    $date = trim($input['date'] ?? date('Y-m-d'));
    $time = trim($input['time'] ?? '10:00:00');
    $eventDate = date('Y-m-d H:i:s', strtotime("{$date} {$time}"));
    $description = trim($input['description'] ?? '');
    $imageUrl = trim($input['imageUrl'] ?? $input['image_url'] ?? '');
    $status = in_array($input['status'] ?? '', ['upcoming', 'past', 'cancelled']) ? $input['status'] : 'upcoming';

    $stmt = $pdo->prepare("
        INSERT INTO events (title, venue, event_date, description, image_url, status, created_by)
        VALUES (:title, :venue, :event_date, :description, :image_url, :status, :created_by)
    ");
    $stmt->execute([
        ':title'       => $title,
        ':venue'       => $venue,
        ':event_date'  => $eventDate,
        ':description' => $description,
        ':image_url'   => $imageUrl,
        ':status'      => $status,
        ':created_by'  => $_SESSION['admin_user']['id'] ?? 1
    ]);

    $eventId = (int)$pdo->lastInsertId();
    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'create_event', 'event', $eventId, "Created event: {$title}");

    json_response([
        'success'  => true,
        'message'  => 'Event created successfully',
        'event_id' => $eventId
    ], 201);
}

// Handle PUT (Update)
if ($method === 'PUT') {
    $input = get_json_input();
    $id = (int)($input['numeric_id'] ?? $input['id'] ?? 0);
    if ($id <= 0) {
        json_response(['success' => false, 'error' => 'Valid event ID is required'], 400);
    }

    $title = trim($input['title'] ?? '');
    $venue = trim($input['venue'] ?? 'Mombasa Mall');
    $date = trim($input['date'] ?? date('Y-m-d'));
    $time = trim($input['time'] ?? '10:00:00');
    $eventDate = date('Y-m-d H:i:s', strtotime("{$date} {$time}"));
    $description = trim($input['description'] ?? '');
    $imageUrl = trim($input['imageUrl'] ?? $input['image_url'] ?? '');
    $status = in_array($input['status'] ?? '', ['upcoming', 'past', 'cancelled']) ? $input['status'] : 'upcoming';

    $stmt = $pdo->prepare("
        UPDATE events SET
            title = :title,
            venue = :venue,
            event_date = :event_date,
            description = :description,
            image_url = :image_url,
            status = :status
        WHERE id = :id
    ");
    $stmt->execute([
        ':title'       => $title,
        ':venue'       => $venue,
        ':event_date'  => $eventDate,
        ':description' => $description,
        ':image_url'   => $imageUrl,
        ':status'      => $status,
        ':id'          => $id
    ]);

    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'update_event', 'event', $id, "Updated event ID: {$id}");

    json_response([
        'success' => true,
        'message' => 'Event updated successfully'
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
        json_response(['success' => false, 'error' => 'Valid event ID is required'], 400);
    }

    $stmt = $pdo->prepare("DELETE FROM events WHERE id = :id");
    $stmt->execute([':id' => $id]);

    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'delete_event', 'event', $id, "Deleted event ID: {$id}");

    json_response([
        'success' => true,
        'message' => 'Event deleted successfully'
    ]);
}

json_response(['success' => false, 'error' => 'Method not allowed'], 405);
