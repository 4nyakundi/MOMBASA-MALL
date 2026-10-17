<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/bootstrap.php';
$keys = ['DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASS'];
$original = [];
foreach ($keys as $key) { $original[$key] = getenv($key); putenv($key); }
$fixture = tempnam(__DIR__ . '/../tmp', 'config-test-');
$checks = 0;
function check($condition, $message) {
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}
try {
    $missing = load_database_settings($fixture . '-missing');
    check($missing['DB_PASS'] === null, 'An absent password must not use a committed fallback.');
    file_put_contents($fixture, "<?php return ['DB_NAME'=>'private_test_database','DB_USER'=>'private_test_user','DB_PASS'=>'test-only-password'];");
    $private = load_database_settings($fixture);
    check($private['DB_NAME'] === 'private_test_database' && $private['DB_PASS'] === 'test-only-password', 'Private cPanel settings must load.');
    check($private['DB_HOST'] === 'localhost' && $private['DB_PORT'] === '3306', 'Default server address must remain available.');
    putenv('DB_PASS=environment-test-password');
    check(load_database_settings($fixture)['DB_PASS'] === 'environment-test-password', 'Environment must override private file settings.');
    putenv('DB_PASS=');
    check(load_database_settings($fixture)['DB_PASS'] === '', 'An explicitly configured empty password must be distinguished from missing configuration.');
    file_put_contents($fixture, '<?php return false;');
    try { load_database_settings($fixture); throw new RuntimeException('Invalid private config was accepted.'); }
    catch (MallServiceException $error) { check($error->reason === 'database_not_configured', 'Invalid private config must have a safe diagnostic code.'); }
    [$status,$body] = mall_error_response(new MallServiceException('database_not_configured', 'Database configuration is required.'));
    check($status === 503 && $body['code'] === 'database_not_configured', 'Readiness failures must be actionable without exposing secrets.');
    [$status,$body] = mall_error_response(new RuntimeException('sensitive database credentials'));
    check($status === 500 && strpos(json_encode($body), 'sensitive') === false, 'Unexpected errors must not expose internal messages.');
    $sqlError = new PDOException('private SQL details');
    $sqlError->errorInfo = ['42S02',1146,'private SQL details'];
    [$status,$body] = mall_error_response($sqlError);
    check($status === 503 && $body['code'] === 'schema_update_required', 'Missing schema must identify the migration requirement.');
    echo $checks . " database configuration checks passed.\n";
} finally {
    unlink($fixture);
    foreach ($original as $key=>$value) putenv($value === false ? $key : $key . '=' . $value);
}
