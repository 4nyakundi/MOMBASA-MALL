<?php
// Run from a trusted server terminal. No browser-accessible bootstrap password.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$email = getenv('MALL_ADMIN_EMAIL');
$password = getenv('MALL_ADMIN_PASSWORD');
if (!filter_var($email,FILTER_VALIDATE_EMAIL) || strlen($password ?: '') < 12) {
    fwrite(STDERR,"Set MALL_ADMIN_EMAIL and MALL_ADMIN_PASSWORD (12+ characters) in the terminal environment.\n");exit(1);
}
$pdo = new PDO('mysql:host='.(getenv('DB_HOST')?:'localhost').';port='.(getenv('DB_PORT')?:'3306').';dbname='.(getenv('DB_NAME')?:'mombasam_mall').';charset=utf8mb4',getenv('DB_USER')?:'mombasam_admall',getenv('DB_PASS'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$stmt=$pdo->prepare("INSERT INTO admin_users (full_name,email,password_hash,role,is_active) VALUES (?,?,?,'superadmin',1) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash),is_active=1");
$stmt->execute(['Mall Administrator',$email,password_hash($password,PASSWORD_DEFAULT)]);
echo "Administrator credential saved. Remove MALL_ADMIN_PASSWORD from the terminal environment.\n";
