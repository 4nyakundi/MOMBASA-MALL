<?php
// Destructive setup is restricted to the isolated test database and port.
if (PHP_SAPI !== 'cli' || getenv('DB_NAME') !== 'mall_alignment_test' || getenv('DB_PORT') !== '33317') throw new RuntimeException('Use the isolated integration database on port 33317.');
$pdo = new PDO('mysql:host=127.0.0.1;port=33317;charset=utf8mb4', getenv('DB_USER') ?: 'root', getenv('DB_PASS') ?: '', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE DATABASE IF NOT EXISTS mall_alignment_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$pdo->exec('USE mall_alignment_test');
$pdo->exec('DROP TABLE IF EXISTS submission_requests, content_metadata, site_settings, legacy_imports');
$pdo->exec(file_get_contents(__DIR__.'/../database/mombasam_mall.sql'));
$pdo->exec(file_get_contents(__DIR__.'/../database/migrations/001_data_alignment.sql'));
$pdo->exec(file_get_contents(__DIR__.'/../database/metadata_seed.sql'));
$password = getenv('MALL_TEST_PASSWORD');
if (!$password) throw new RuntimeException('Supply MALL_TEST_PASSWORD.');
$stmt = $pdo->prepare('INSERT INTO admin_users (id,full_name,email,password_hash,role) VALUES (?,?,?,?,?)');
foreach ([[1,'Test Admin','admin@mombasamall.co.ke','superadmin'],[3,'Test Editor','events@mombasamall.co.ke','editor'],[4,'Test Moderator','advertising@mombasamall.co.ke','moderator']] as $user) {
    $stmt->execute([$user[0],$user[1],$user[2],password_hash($password,PASSWORD_DEFAULT),$user[3]]);
}
echo "Isolated test schema ready.\n";
