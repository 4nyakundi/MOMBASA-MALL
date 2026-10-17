<?php
/**
 * Mombasa Mall - Activations & Pop-Up Booking API
 * Inserts submission directly into MySQL activation_leads
 */

require_once __DIR__ . '/../config.php';

$pdo = get_db_connection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['success' => false, 'error' => 'POST method required'], 405);
}

$input = input_aliases(get_json_input(), ['company' => ['companyName'], 'applicant' => ['contactName'], 'type' => ['activationType'], 'startDate' => ['bookingStartDate'], 'duration' => ['durationDays'], 'concept' => ['message']]);
$companyName = trim($input['company'] ?? $input['company_name'] ?? '');
$contactName = trim($input['applicant'] ?? $input['contact_name'] ?? '');
$email = trim($input['email'] ?? '');
$phone = trim($input['phone'] ?? '');

if (empty($companyName) || empty($contactName) || empty($email) || empty($phone)) {
    json_response(['success' => false, 'error' => 'Company name, applicant name, email, and phone are required'], 400);
}

$activationType = trim($input['type'] ?? $input['activation_type'] ?? 'Central Atrium Showcase');
$startDate = trim($input['startDate'] ?? $input['booking_start_date'] ?? date('Y-m-d'));
$durationDays = max(1, (int)($input['duration'] ?? $input['duration_days'] ?? 1));
validate_date($startDate);
$endDate = date('Y-m-d', strtotime("{$startDate} +" . ($durationDays - 1) . " days"));
$concept = trim($input['concept'] ?? $input['concept_description'] ?? '');

validate_email($email);
$request = begin_submission($pdo, 'activation', $input);
$refCode = 'ACT-' . strtoupper(bin2hex(random_bytes(10)));

$stmt = $pdo->prepare("
    INSERT INTO activation_leads (
        ref_code, company_name, contact_name, email, phone,
        activation_type, booking_start_date, duration_days, booking_end_date,
        concept_description, status
    ) VALUES (
        :ref_code, :company_name, :contact_name, :email, :phone,
        :activation_type, :booking_start_date, :duration_days, :booking_end_date,
        :concept_description, 'new'
    )
");
$stmt->execute([
    ':ref_code'            => $refCode,
    ':company_name'        => $companyName,
    ':contact_name'        => $contactName,
    ':email'               => $email,
    ':phone'               => $phone,
    ':activation_type'     => $activationType,
    ':booking_start_date'  => $startDate,
    ':duration_days'       => $durationDays,
    ':booking_end_date'    => $endDate,
    ':concept_description' => $concept
]);

$leadId = (int)$pdo->lastInsertId();

finish_submission($pdo, $request, [
    'success'  => true,
    'message'  => 'Your brand activation reservation request has been received. Our leasing team will contact you shortly.',
    'ref_code' => $refCode,
    'lead_id'  => $leadId
]);
