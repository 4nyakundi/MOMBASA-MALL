<?php
/**
 * Mombasa Mall - Admin Dashboard Metrics API
 * Returns real-time aggregate statistics from MySQL mombasam_mall
 */

require_once __DIR__ . '/../config.php';

authorize_resource('dashboard');
$pdo = get_db_connection();

try {
    // 1. Fetch aggregate metrics
    $metricsStmt = $pdo->query("SELECT * FROM v_dashboard_metrics LIMIT 1");
    $metrics = $metricsStmt->fetch() ?: [];

    // If view fails or returns empty, calculate directly
    if (empty($metrics)) {
        $metrics = [
            'total_active_stores'   => (int)$pdo->query("SELECT COUNT(*) FROM stores WHERE status = 'active'")->fetchColumn(),
            'total_contact_leads'   => (int)$pdo->query("SELECT COUNT(*) FROM contact_leads")->fetchColumn(),
            'total_led_leads'       => (int)$pdo->query("SELECT COUNT(*) FROM led_leads")->fetchColumn(),
            'total_activation_leads'=> (int)$pdo->query("SELECT COUNT(*) FROM activation_leads")->fetchColumn(),
            'total_playon_bookings' => (int)$pdo->query("SELECT COUNT(*) FROM playon_bookings")->fetchColumn(),
            'new_contact_leads'     => (int)$pdo->query("SELECT COUNT(*) FROM contact_leads WHERE status = 'new'")->fetchColumn(),
            'new_led_leads'         => (int)$pdo->query("SELECT COUNT(*) FROM led_leads WHERE status = 'new'")->fetchColumn(),
            'new_activation_leads'  => (int)$pdo->query("SELECT COUNT(*) FROM activation_leads WHERE status = 'new'")->fetchColumn(),
            'new_playon_bookings'   => (int)$pdo->query("SELECT COUNT(*) FROM playon_bookings WHERE status = 'new'")->fetchColumn(),
            'upcoming_events'       => (int)$pdo->query("SELECT COUNT(*) FROM events WHERE status = 'upcoming'")->fetchColumn(),
            'pending_reviews'       => (int)$pdo->query("SELECT COUNT(*) FROM reviews WHERE status = 'pending'")->fetchColumn(),
            'published_articles'    => (int)$pdo->query("SELECT COUNT(*) FROM blog_posts WHERE status = 'published'")->fetchColumn()
        ];
    }

    // 2. Fetch Recent Leads (Latest 10 across all channels)
    $leadsStmt = $pdo->query("SELECT * FROM v_all_leads ORDER BY submitted_at DESC LIMIT 10");
    $recentLeads = in_array($_SESSION['admin_user']['role'], ['superadmin','admin','moderator']) ? ($leadsStmt->fetchAll() ?: []) : [];
    $metrics['upcoming_events'] = (int)$pdo->query("SELECT COUNT(*) FROM events WHERE status='upcoming' AND COALESCE(event_end_date,event_date) >= CURRENT_DATE")->fetchColumn();

    json_response([
        'success'      => true,
        'metrics'      => $metrics,
        'recent_leads' => $recentLeads,
        'timestamp'    => date('c')
    ]);
} catch (Exception $e) {
    json_response([
        'success' => false,
        'error'   => 'Dashboard data unavailable.'
    ], 500);
}
