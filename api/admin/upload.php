<?php
require_once __DIR__ . '/../config.php';
authorize_resource('upload');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(['success' => false, 'error' => 'POST required'], 405);
$file = $_FILES['file'] ?? null;
if (!$file || $file['error'] !== UPLOAD_ERR_OK || $file['size'] > 20 * 1024 * 1024) json_response(['success' => false, 'error' => 'Choose a file up to 20 MB.'], 422);
$types = ['image/jpeg'=>'jpg', 'image/png'=>'png', 'image/webp'=>'webp', 'image/gif'=>'gif', 'video/mp4'=>'mp4', 'video/quicktime'=>'mov'];
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
if (!isset($types[$mime])) json_response(['success' => false, 'error' => 'Use JPG, PNG, WebP, GIF, MP4 or MOV.'], 422);
$folder = __DIR__ . '/../../uploads';
if (!is_dir($folder) && !mkdir($folder, 0755, true)) throw new RuntimeException('Cannot create upload directory.');
$name = bin2hex(random_bytes(16)) . '.' . $types[$mime];
if (!move_uploaded_file($file['tmp_name'], $folder . '/' . $name)) throw new RuntimeException('Upload failed.');
json_response(['success' => true, 'url' => '/uploads/' . $name], 201);
