<?php
/**
 * Mombasa Mall - LED Advertising Booking API
 * Inserts submission directly into MySQL led_leads
 */

require_once __DIR__ . '/../config.php';

$pdo = get_db_connection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['success' => false, 'error' => 'POST method required'], 405);
}

$input = get_json_input();
$businessName = trim($input['businessName'] ?? $input['business_name'] ?? '');
$contactName = trim($input['contactName'] ?? $input['contact_name'] ?? '');
$email = trim($input['email'] ?? '');
$phone = trim($input['phone'] ?? '');

if (empty($businessName) || empty($contactName) || empty($email) || empty($phone)) {
    json_response(['success' => false, 'error' => 'Business name, contact person, email, and phone are required'], 400);
}

$packageRequested = trim($input['package'] ?? $input['package_requested'] ?? 'Full Package');
$durationRequested = trim($input['duration'] ?? $input['duration_requested'] ?? '1 Month');
$durationCode = trim($input['duration_code'] ?? '1m');
$slotLength = trim($input['slot_length'] ?? '15s every 3m (24/7)');
$costTotal = (float)($input['cost'] ?? $input['estimated_cost_total'] ?? 0);
$costKes = (float)($input['estimated_cost_kes'] ?? ($costTotal / 1.16));
$costVat = (float)($input['estimated_cost_vat'] ?? ($costTotal - $costKes));
$notes = trim($input['notes'] ?? $input['message'] ?? '');

$refCode = 'LED-' . strtoupper(substr(uniqid(), -6));

$stmt = $pdo->prepare("
    INSERT INTO led_leads (
        ref_code, business_name, contact_name, email, phone,
        package_requested, duration_requested, duration_code, slot_length,
        estimated_cost_kes, estimated_cost_vat, estimated_cost_total, notes, status
    ) VALUES (
        :ref_code, :business_name, :contact_name, :email, :phone,
        :package_requested, :duration_requested, :duration_code, :slot_length,
        :estimated_cost_kes, :estimated_cost_vat, :estimated_cost_total, :notes, 'new'
    )
");
$stmt->execute([
    ':ref_code'             => $refCode,
    ':business_name'        => $businessName,
    ':contact_name'         => $contactName,
    ':email'                => $email,
    ':phone'                => $phone,
    ':package_requested'    => $packageRequested,
    ':duration_requested'   => $durationRequested,
    ':duration_code'        => $durationCode,
    ':slot_length'          => $slotLength,
    ':estimated_cost_kes'   => $costKes,
    ':estimated_cost_vat'   => $costVat,
    ':estimated_cost_total' => $costTotal,
    ':notes'                => $notes
]);

$leadId = (int)$pdo->lastInsertId();

json_response([
    'success'  => true,
    'message'  => 'Your LED campaign booking enquiry has been received. Our advertising department will reach out shortly.',
    'ref_code' => $refCode,
    'lead_id'  => $leadId
], 201);
