<?php
// Configuration stays outside public_html so Git updates never overwrite secrets.
class MallServiceException extends RuntimeException {
    public $reason;
    public function __construct($reason, $message) {
        parent::__construct($message);
        $this->reason = $reason;
    }
}

function load_database_settings($privateFile = null) {
    $privateFile = $privateFile ?? dirname(__DIR__, 2) . '/mombasa-mall-config.php';
    $private = [];
    if (is_file($privateFile)) {
        if (!is_readable($privateFile)) throw new MallServiceException('database_not_configured', 'The website database configuration is not readable. Please contact the mall team.');
        $private = require $privateFile;
        if (!is_array($private)) throw new MallServiceException('database_not_configured', 'The website database configuration needs attention. Please contact the mall team.');
    }
    $defaults = ['DB_HOST'=>'localhost', 'DB_PORT'=>'3306', 'DB_NAME'=>'mombasam_mall', 'DB_USER'=>'mombasam_admall', 'DB_PASS'=>null];
    $settings = [];
    foreach ($defaults as $key=>$default) {
        $environment = getenv($key);
        $value = $environment !== false ? $environment : ($private[$key] ?? $default);
        if ($value !== null && !is_scalar($value)) throw new MallServiceException('database_not_configured', 'The website database configuration needs attention. Please contact the mall team.');
        $settings[$key] = $value === null ? null : (string)$value;
    }
    return $settings;
}

function mall_error_response($error) {
    if ($error instanceof MallServiceException) return [503, ['success'=>false, 'code'=>$error->reason, 'error'=>$error->getMessage()]];
    if ($error instanceof InvalidArgumentException) return [422, ['success'=>false, 'code'=>'validation_failed', 'error'=>$error->getMessage()]];
    if ($error instanceof PDOException) {
        $state = $error->errorInfo[0] ?? $error->getCode();
        if ($state === '42S02' || $state === '42S22') return [503, ['success'=>false, 'code'=>'schema_update_required', 'error'=>'Online forms are temporarily unavailable while the website database is updated. Please contact the mall team.']];
        if ($state === '23000') return [409, ['success'=>false, 'code'=>'record_conflict', 'error'=>'This record conflicts with an existing record.']];
    }
    return [500, ['success'=>false, 'code'=>'server_error', 'error'=>'The server could not complete this request. Please try again.']];
}
