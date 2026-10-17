<?php
// Public projections only. Never route private inboxes or staff through here.
define('MALL_PUBLIC_READ', true);
require_once __DIR__ . '/../config.php';
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_response(['success' => false, 'error' => 'GET required'], 405);
$resource = $_GET['resource'] ?? '';
$resources = ['stores' => 'active', 'events' => null, 'blog' => 'published', 'reviews' => 'approved', 'gallery' => null];
if ($resource === 'site') {
    $pdo = get_db_connection();
    $stmt = $pdo->prepare('SELECT payload FROM site_settings WHERE setting_key = ?');
    $stmt->execute(['homepage']);
    $data = $stmt->fetchColumn();
    json_response(['success' => true, 'site' => $data ? json_decode($data, true) : json_decode(file_get_contents(__DIR__ . '/../../json/site-data.json'), true)]);
}
if (!array_key_exists($resource, $resources)) json_response(['success' => false, 'error' => 'Unknown resource'], 404);
$_GET = $resources[$resource] ? ['status' => $resources[$resource]] : [];
require __DIR__ . '/../admin/' . $resource . '.php';
