<?php
/**
 * Mombasa Mall - Unified Leads Management API
 * Supports:
 *   GET    /api/admin/leads.php?type=led|activation|contact|playon|all
 *   PUT    /api/admin/leads.php (update status or admin_notes)
 *   DELETE /api/admin/leads.php?type=X&id=Y
 */

require_once __DIR__ . '/../config.php';

$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];

// Handle GET
if ($method === 'GET') {
    $type = $_GET['type'] ?? 'all';
    $status = $_GET['status'] ?? null;

    $response = ['success' => true];

    // Helper for table querying
    $queryTable = function($table, $orderCol = 'submitted_at') use ($pdo, $status) {
        $sql = "SELECT * FROM `{$table}` WHERE 1=1";
        $params = [];
        if ($status) {
            $sql .= " AND status = :status";
            $params[':status'] = $status;
        }
        $sql .= " ORDER BY `{$orderCol}` DESC, id DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll() ?: [];
    };

    if ($type === 'led' || $type === 'all') {
        $ledRows = $queryTable('led_leads');
        $formatted = [];
        foreach ($ledRows as $r) {
            $formatted[] = [
                'id'                   => (string)$r['id'],
                'numeric_id'           => (int)$r['id'],
                'ref_code'             => $r['ref_code'],
                'businessName'         => $r['business_name'],
                'company'              => $r['business_name'],
                'contactName'          => $r['contact_name'],
                'name'                 => $r['contact_name'],
                'email'                => $r['email'],
                'phone'                => $r['phone'],
                'package'              => $r['package_requested'],
                'package_requested'    => $r['package_requested'],
                'duration'             => $r['duration_requested'],
                'duration_requested'   => $r['duration_requested'],
                'duration_code'        => $r['duration_code'],
                'slot_length'          => $r['slot_length'],
                'cost'                 => (float)$r['estimated_cost_total'],
                'estimated_cost_kes'   => (float)$r['estimated_cost_kes'],
                'estimated_cost_vat'   => (float)$r['estimated_cost_vat'],
                'estimated_cost_total' => (float)$r['estimated_cost_total'],
                'notes'                => $r['notes'] ?: '',
                'status'               => $r['status'] ?: 'new',
                'admin_notes'          => $r['admin_notes'] ?: '',
                'date'                 => date('M d, Y', strtotime($r['submitted_at'])),
                'submitted_at'         => $r['submitted_at']
            ];
        }
        $response['ledLeads'] = $formatted;
    }

    if ($type === 'activation' || $type === 'all') {
        $actRows = $queryTable('activation_leads');
        $formatted = [];
        foreach ($actRows as $r) {
            $formatted[] = [
                'id'                  => (string)$r['id'],
                'numeric_id'          => (int)$r['id'],
                'ref_code'            => $r['ref_code'],
                'company'             => $r['company_name'],
                'companyName'         => $r['company_name'],
                'applicant'           => $r['contact_name'],
                'contactName'         => $r['contact_name'],
                'email'               => $r['email'],
                'phone'               => $r['phone'],
                'type'                => $r['activation_type'],
                'activation_type'     => $r['activation_type'],
                'startDate'           => $r['booking_start_date'],
                'booking_start_date'  => $r['booking_start_date'],
                'duration'            => (int)$r['duration_days'],
                'duration_days'       => (int)$r['duration_days'],
                'concept'             => $r['concept_description'],
                'concept_description' => $r['concept_description'],
                'status'              => $r['status'] ?: 'new',
                'admin_notes'         => $r['admin_notes'] ?: '',
                'date'                => date('M d, Y', strtotime($r['submitted_at'])),
                'submitted_at'        => $r['submitted_at']
            ];
        }
        $response['activationLeads'] = $formatted;
    }

    if ($type === 'contact' || $type === 'all') {
        $cntRows = $queryTable('contact_leads');
        $formatted = [];
        foreach ($cntRows as $r) {
            $formatted[] = [
                'id'           => (string)$r['id'],
                'numeric_id'   => (int)$r['id'],
                'ref_code'     => $r['ref_code'],
                'name'         => $r['name'],
                'email'        => $r['email'],
                'phone'        => $r['phone'] ?: '',
                'subject'      => $r['subject'] ?: 'General Inquiry',
                'message'      => $r['message'],
                'status'       => $r['status'] ?: 'new',
                'admin_notes'  => $r['admin_notes'] ?: '',
                'date'         => date('M d, Y', strtotime($r['submitted_at'])),
                'submitted_at' => $r['submitted_at']
            ];
        }
        $response['contactLeads'] = $formatted;
    }

    if ($type === 'playon' || $type === 'all') {
        $plyRows = $queryTable('playon_bookings');
        $formatted = [];
        foreach ($plyRows as $r) {
            $formatted[] = [
                'id'                  => (string)$r['id'],
                'numeric_id'          => (int)$r['id'],
                'ref_code'            => $r['ref_code'],
                'parent_name'         => $r['parent_name'],
                'name'                => $r['parent_name'],
                'phone'               => $r['phone'],
                'email'               => $r['email'],
                'booking_type'        => $r['booking_type'],
                'booking_date'        => $r['booking_date'],
                'session_time'        => $r['session_time'],
                'child_count'         => (int)$r['child_count'],
                'adult_count'         => (int)$r['adult_count'],
                'estimated_total_kes' => (float)$r['estimated_total_kes'],
                'special_requests'    => $r['special_requests'] ?: '',
                'status'              => $r['status'] ?: 'new',
                'admin_notes'         => $r['admin_notes'] ?: '',
                'date'                => date('M d, Y', strtotime($r['submitted_at'])),
                'submitted_at'        => $r['submitted_at']
            ];
        }
        $response['playonBookings'] = $formatted;
    }

    json_response($response);
}

// Handle PUT (Update status/notes)
if ($method === 'PUT') {
    $input = get_json_input();
    $type = $input['type'] ?? 'contact';
    $id = (int)($input['numeric_id'] ?? $input['id'] ?? 0);
    $status = $input['status'] ?? null;
    $notes = $input['admin_notes'] ?? null;

    if ($id <= 0) {
        json_response(['success' => false, 'error' => 'Valid lead ID is required'], 400);
    }

    $tableMap = [
        'contact'    => 'contact_leads',
        'led'        => 'led_leads',
        'activation' => 'activation_leads',
        'playon'     => 'playon_bookings'
    ];

    $tableName = $tableMap[$type] ?? 'contact_leads';

    $stmt = $pdo->prepare("
        UPDATE `{$tableName}` SET
            status = COALESCE(:status, status),
            admin_notes = COALESCE(:notes, admin_notes)
        WHERE id = :id
    ");
    $stmt->execute([
        ':status' => $status,
        ':notes'  => $notes,
        ':id'     => $id
    ]);

    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'update_lead_status', $tableName, $id, "Updated lead status to {$status}");

    json_response([
        'success' => true,
        'message' => 'Lead updated successfully'
    ]);
}

// Handle DELETE
if ($method === 'DELETE') {
    $type = $_GET['type'] ?? 'contact';
    $id = (int)($_GET['id'] ?? 0);

    if ($id <= 0) {
        $input = get_json_input();
        $id = (int)($input['id'] ?? 0);
        $type = $input['type'] ?? $type;
    }

    if ($id <= 0) {
        json_response(['success' => false, 'error' => 'Valid lead ID is required'], 400);
    }

    $tableMap = [
        'contact'    => 'contact_leads',
        'led'        => 'led_leads',
        'activation' => 'activation_leads',
        'playon'     => 'playon_bookings'
    ];

    $tableName = $tableMap[$type] ?? 'contact_leads';

    $stmt = $pdo->prepare("DELETE FROM `{$tableName}` WHERE id = :id");
    $stmt->execute([':id' => $id]);

    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'delete_lead', $tableName, $id, "Deleted lead ID {$id}");

    json_response([
        'success' => true,
        'message' => 'Lead deleted successfully'
    ]);
}

json_response(['success' => false, 'error' => 'Method not allowed'], 405);
