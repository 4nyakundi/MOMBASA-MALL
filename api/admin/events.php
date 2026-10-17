<?php
require_once __DIR__ . '/../config.php';
authorize_resource('events');
$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'GET') {
    $events = $pdo->query('SELECT * FROM events ORDER BY event_date DESC, id DESC')->fetchAll();
    $photos = [];
    foreach ($pdo->query('SELECT * FROM event_photos ORDER BY sort_order, id') as $photo) $photos[$photo['event_id']][] = $photo['image_url'];
    $formatted = [];
    foreach ($events as $e) {
        if (defined('MALL_PUBLIC_READ') && $e['status'] === 'cancelled') continue;
        if (!defined('MALL_PUBLIC_READ') && isset($_GET['status']) && $_GET['status'] !== $e['status']) continue;
        $meta = metadata_get($pdo, 'events', $e['id']);
        $type = $e['status'];
        if ($type !== 'cancelled' && substr($e['event_end_date'] ?: $e['event_date'], 0, 10) < date('Y-m-d')) $type = 'past';
        $formatted[] = [
            'id'=>(string)$e['id'], 'numeric_id'=>(int)$e['id'], 'title'=>$e['title'], 'venue'=>$e['venue'],
            'date'=>substr($e['event_date'],0,10), 'eventDate'=>substr($e['event_date'],0,10),
            'time'=>$meta['eventTime'] ?? substr($e['event_date'],11,5), 'eventTime'=>$meta['eventTime'] ?? substr($e['event_date'],11,5),
            'event_date'=>$e['event_date'], 'event_end_date'=>$e['event_end_date'], 'description'=>$e['description'],
            'summary'=>$e['description'], 'details'=>$e['description'], 'imageUrl'=>$e['image_url'],
            'photoUrls'=>$photos[$e['id']] ?? ($e['image_url'] ? [$e['image_url']] : []),
            'videoUrl'=>$meta['videoUrl'] ?? '', 'status'=>$e['status'], 'type'=>$type
        ];
    }
    json_response(['success'=>true, 'events'=>$formatted, 'count'=>count($formatted)]);
}
if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    require_existing($pdo, 'events', $id);
    $pdo->prepare('DELETE FROM events WHERE id = ?')->execute([$id]);
    log_activity($pdo, $_SESSION['admin_user']['id'], 'delete_event', 'event', $id);
    json_response(['success'=>true]);
}
if (!in_array($method, ['POST','PUT'])) json_response(['success'=>false,'error'=>'Method not allowed'],405);
$input = get_json_input();
$id = (int)($input['numeric_id'] ?? $input['id'] ?? 0);
if ($method === 'PUT') require_existing($pdo, 'events', $id);
$title = trim($input['title'] ?? '');
if (!$title) json_response(['success'=>false,'error'=>'Event title is required.'],422);
$date = $input['date'] ?? $input['eventDate'] ?? '';
validate_date($date);
$time = trim($input['eventTime'] ?? $input['time'] ?? '10:00');
// The editor may supply a display range; retain it and use its first time for ordering.
$start = preg_split('/\s*[–—]\s*|\s+-\s+/', $time)[0];
$parsed = strtotime($date . ' ' . $start);
if ($parsed === false) json_response(['success'=>false,'error'=>'Enter a valid event time.'],422);
$status = $input['status'] ?? $input['type'] ?? 'upcoming';
if (!in_array($status,['upcoming','past','cancelled'])) json_response(['success'=>false,'error'=>'Invalid event status.'],422);
$photoUrls = $input['photoUrls'] ?? [];
if (!is_array($photoUrls)) json_response(['success'=>false,'error'=>'Photos must be a list.'],422);
foreach ($photoUrls as $url) validate_media_url($url);
$image = validate_media_url($input['imageUrl'] ?? $input['image_url'] ?? ($photoUrls[0] ?? ''));
$video = validate_media_url($input['videoUrl'] ?? '');
$end = $input['event_end_date'] ?? null;
if ($end && (strtotime($end) === false || strtotime($end) < $parsed)) json_response(['success'=>false,'error'=>'Event end must follow its start.'],422);
$values = [$title, $input['venue'] ?? 'Mombasa Mall', date('Y-m-d H:i:s',$parsed), $end,
    $input['details'] ?? $input['summary'] ?? $input['description'] ?? '', $image, $status];
$pdo->beginTransaction();
if ($method === 'POST') {
    $pdo->prepare('INSERT INTO events (title,venue,event_date,event_end_date,description,image_url,status,created_by) VALUES (?,?,?,?,?,?,?,?)')->execute(array_merge($values,[$_SESSION['admin_user']['id']]));
    $id = (int)$pdo->lastInsertId();
} else {
    $pdo->prepare('UPDATE events SET title=?,venue=?,event_date=?,event_end_date=?,description=?,image_url=?,status=? WHERE id=?')->execute(array_merge($values,[$id]));
    $pdo->prepare('DELETE FROM event_photos WHERE event_id=?')->execute([$id]);
}
$stmt = $pdo->prepare('INSERT INTO event_photos (event_id,image_url,sort_order) VALUES (?,?,?)');
foreach ($photoUrls as $order=>$url) $stmt->execute([$id,$url,$order]);
metadata_save($pdo,'events',$id,['eventTime'=>$time,'videoUrl'=>$video]);
log_activity($pdo,$_SESSION['admin_user']['id'],'save_event','event',$id);
$pdo->commit();
json_response(['success'=>true,'event_id'=>$id,'id'=>(string)$id],$method==='POST'?201:200);
