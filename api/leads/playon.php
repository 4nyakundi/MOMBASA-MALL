<?php
/**
 * Mombasa Mall - Play On Bookings API
 * Inserts submission directly into MySQL playon_bookings
 */

require_once __DIR__ . '/../config.php';

$pdo = get_db_connection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['success' => false, 'error' => 'POST method required'], 405);
}

$input = get_json_input();
$parentName = trim($input['parent_name'] ?? $input['name'] ?? '');
$phone = trim($input['phone'] ?? '');
$email = trim($input['email'] ?? '');

if (empty($parentName) || empty($phone) || empty($email)) {
    json_response(['success' => false, 'error' => 'Parent name, phone number, and email are required'], 400);
}

$bookingType = trim($input['booking_type'] ?? 'session');
$bookingDate = trim($input['booking_date'] ?? date('Y-m-d'));
$sessionTime = trim($input['session_time'] ?? '10:00 AM - 12:00 PM');
$childCount = max(1, (int)($input['child_count'] ?? 1));
$adultCount = max(0, (int)($input['adult_count'] ?? 0));
$estimatedTotal = (float)($input['estimated_total_kes'] ?? ($childCount * 1000 + $adultCount * 500));
$specialRequests = trim($input['special_requests'] ?? '');

$refCode = 'PLY-' . strtoupper(substr(uniqid(), -6));

$stmt = $pdo->prepare("
    INSERT INTO playon_bookings (
        ref_code, parent_name, phone, email, booking_type,
        booking_date, session_time, child_count, adult_count,
        estimated_total_kes, special_requests, status
    ) VALUES (
        :ref_code, :parent_name, :phone, :email, :booking_type,
        :booking_date, :session_time, :child_count, :adult_count,
        :estimated_total_kes, :special_requests, 'new'
    )
");
$stmt->execute([
    ':ref_code'            => $refCode,
    ':parent_name'         => $parentName,
    ':phone'               => $phone,
    ':email'               => $email,
    ':booking_type'        => $bookingType,
    ':booking_date'        => $bookingDate,
    ':session_time'        => $sessionTime,
    ':child_count'         => $childCount,
    ':adult_count'         => $adultCount,
    ':estimated_total_kes' => $estimatedTotal,
    ':special_requests'    => $specialRequests
]);

$bookingId = (int)$pdo->lastInsertId();

json_response([
    'success'    => true,
    'message'    => 'Your Play On session booking has been confirmed! We have saved your reservation.',
    'ref_code'   => $refCode,
    'booking_id' => $bookingId
], 201);
