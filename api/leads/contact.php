<?php
/**
 * Mombasa Mall - Contact Form API
 * Inserts submission directly into MySQL contact_leads
 */

require_once __DIR__ . '/../config.php';

$pdo = get_db_connection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['success' => false, 'error' => 'POST method required'], 405);
}

$input = input_aliases(get_json_input(), []);
$name = trim($input['name'] ?? '');
$email = trim($input['email'] ?? '');
$phone = trim($input['phone'] ?? '');
$subject = trim($input['subject'] ?? 'General Inquiry');
$message = trim($input['message'] ?? '');

if (empty($name) || empty($email) || empty($message)) {
    json_response(['success' => false, 'error' => 'Name, email, and message are required'], 400);
}

validate_email($email);
$request = begin_submission($pdo, 'contact', $input);
$refCode = 'CNT-' . strtoupper(bin2hex(random_bytes(10)));

$stmt = $pdo->prepare("
    INSERT INTO contact_leads (ref_code, name, email, phone, subject, message, status)
    VALUES (:ref_code, :name, :email, :phone, :subject, :message, 'new')
");
$stmt->execute([
    ':ref_code' => $refCode,
    ':name'     => $name,
    ':email'    => $email,
    ':phone'    => $phone,
    ':subject'  => $subject,
    ':message'  => $message
]);

$leadId = (int)$pdo->lastInsertId();

finish_submission($pdo, $request, [
    'success'  => true,
    'message'  => 'Your inquiry has been received. Our team will contact you shortly.',
    'ref_code' => $refCode,
    'lead_id'  => $leadId
]);
