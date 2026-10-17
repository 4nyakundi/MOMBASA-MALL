<?php
// Read-only readiness check. It never returns credentials, records or SQL errors.
require_once __DIR__ . '/../config.php';
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_response(['success'=>false, 'error'=>'GET required'],405);
$pdo = get_db_connection();
$existing = $pdo->query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()')->fetchAll(PDO::FETCH_COLUMN);
$required = ['admin_users','stores','store_photos','events','event_photos','blog_posts','reviews','gallery','activity_log','contact_leads','led_leads','activation_leads','playon_bookings','content_metadata','submission_requests','site_settings','legacy_imports'];
if (array_diff($required, $existing)) throw new MallServiceException('schema_update_required', 'The website database needs its alignment migration before online forms can be used.');
json_response(['success'=>true, 'code'=>'ready', 'forms_ready'=>true]);
