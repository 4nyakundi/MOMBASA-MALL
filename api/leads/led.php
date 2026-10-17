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

$input = input_aliases(get_json_input(), ['package' => ['packageRequested'], 'duration' => ['durationRequested'], 'duration_code' => ['durationMonths'], 'slot_length' => ['slotLength'], 'cost' => ['estimatedCost'], 'estimated_cost_kes' => ['subtotal'], 'estimated_cost_vat' => ['vat']]);
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
$packageCode = $input['package_code'] ?? '';
$rates = ['full'=>['2w'=>80000,'1m'=>180000,'3m'=>620000], 'outdoor'=>['2w'=>70000,'1m'=>150000,'3m'=>540000], 'indoor'=>['2w'=>20000,'1m'=>40000,'3m'=>150000]];
if (!isset($rates[$packageCode][$durationCode])) json_response(['success'=>false,'error'=>'Choose a valid campaign package and duration.'],422);
$packageRequested = ['full'=>'Full Package (Outdoor + Indoor Network)','outdoor'=>'Outdoor Mega Screen (1280×720px)','indoor'=>'Indoor Screen Network (4 Screens)'][$packageCode];
$durationRequested = ['2w'=>'2 Weeks Duration','1m'=>'1 Month (30 Days)','3m'=>'Quarterly (3 Months)'][$durationCode];
$costKes = $rates[$packageCode][$durationCode];
$costVat = round($costKes * 0.16, 2);
$costTotal = $costKes + $costVat;
$notes = trim($input['notes'] ?? $input['message'] ?? '');

validate_email($email);
$request = begin_submission($pdo, 'led', $input);
$refCode = 'LED-' . strtoupper(bin2hex(random_bytes(10)));

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

finish_submission($pdo, $request, [
    'success'  => true,
    'message'  => 'Your LED campaign booking enquiry has been received. Our advertising department will reach out shortly.',
    'ref_code' => $refCode,
    'lead_id'  => $leadId
]);
