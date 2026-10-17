<?php
// Shared boundary between the browser contract and the relational schema.
function input_aliases($input, $aliases) {
    foreach ($aliases as $target => $names) {
        if (array_key_exists($target, $input)) continue;
        foreach ($names as $name) {
            if (array_key_exists($name, $input)) { $input[$target] = $input[$name]; break; }
        }
    }
    return $input;
}

function validate_email($email) {
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 200) {
        json_response(['success' => false, 'error' => 'Enter a valid email address.'], 422);
    }
}

function validate_date($value) {
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) {
        json_response(['success' => false, 'error' => 'Enter a valid date (YYYY-MM-DD).'], 422);
    }
    return $date;
}

function validate_media_url($url) {
    if ($url === '') return '';
    if (strlen($url) > 500 || preg_match('/[\x00-\x1f<>"\']/', $url) ||
        !(preg_match('#^https?://#i', $url) || preg_match('#^/(?!/)#', $url) || preg_match('#^(?:\.\.?/)?assets/#', $url))) {
        json_response(['success' => false, 'error' => 'Upload media or supply a valid HTTP(S) or site asset URL.'], 422);
    }
    return $url;
}

function metadata_get($pdo, $type, $id) {
    $stmt = $pdo->prepare('SELECT payload FROM content_metadata WHERE entity_type = ? AND entity_id = ?');
    $stmt->execute([$type, $id]);
    return json_decode($stmt->fetchColumn() ?: '{}', true) ?: [];
}

function metadata_save($pdo, $type, $id, $data) {
    $stmt = $pdo->prepare('INSERT INTO content_metadata (entity_type, entity_id, payload) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)');
    $stmt->execute([$type, $id, json_encode($data, JSON_UNESCAPED_SLASHES)]);
}

function require_existing($pdo, $table, $id) {
    $stmt = $pdo->prepare("SELECT id FROM `$table` WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetchColumn()) json_response(['success' => false, 'error' => 'Record no longer exists. Refresh and try again.'], 404);
}

// Lock the client request ID in the same transaction as its lead insertion.
// A retry after a lost response returns the original acknowledgement.
function begin_submission($pdo, $type, $input) {
    $key = (string)($input['request_id'] ?? $input['id'] ?? '');
    if (!preg_match('/^[A-Za-z0-9_-]{1,100}$/', $key)) {
        json_response(['success' => false, 'error' => 'A valid request ID is required.'], 422);
    }
    $hash = hash('sha256', json_encode($input));
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('INSERT IGNORE INTO submission_requests (lead_type, request_id, payload_hash) VALUES (?, ?, ?)');
    $stmt->execute([$type, $key, $hash]);
    $stmt = $pdo->prepare('SELECT payload_hash, response_json FROM submission_requests WHERE lead_type = ? AND request_id = ? FOR UPDATE');
    $stmt->execute([$type, $key]);
    $row = $stmt->fetch();
    if (!hash_equals($row['payload_hash'], $hash)) {
        $pdo->rollBack();
        json_response(['success' => false, 'error' => 'This request ID was already used with different details. Reload the form before submitting new details.'], 409);
    }
    if ($row['response_json']) {
        $pdo->commit();
        json_response(json_decode($row['response_json'], true));
    }
    return [$type, $key];
}

function finish_submission($pdo, $request, $response) {
    $stmt = $pdo->prepare('UPDATE submission_requests SET response_json = ? WHERE lead_type = ? AND request_id = ?');
    $stmt->execute([json_encode($response), $request[0], $request[1]]);
    $pdo->commit();
    json_response($response, 201);
}
