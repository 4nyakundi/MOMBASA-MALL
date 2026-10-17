<?php
/**
 * Mombasa Mall - Stores API
 * Supports:
 *   GET    /api/admin/stores.php (list all stores with photos)
 *   POST   /api/admin/stores.php (create new store)
 *   PUT    /api/admin/stores.php (update store)
 *   DELETE /api/admin/stores.php?id=X (delete store)
 */

require_once __DIR__ . '/../config.php';

authorize_resource('stores');
$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];

// Handle GET
if ($method === 'GET') {
    $floor = $_GET['floor'] ?? null;
    $category = $_GET['category'] ?? null;
    $status = $_GET['status'] ?? null;

    $sql = "SELECT * FROM stores WHERE 1=1";
    $params = [];

    if ($floor) {
        $sql .= " AND floor = :floor";
        $params[':floor'] = $floor;
    }
    if ($category) {
        $sql .= " AND category = :category";
        $params[':category'] = $category;
    }
    if ($status) {
        $sql .= " AND status = :status";
        $params[':status'] = $status;
    }

    $sql .= " ORDER BY sort_order ASC, id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $stores = $stmt->fetchAll();

    // Fetch all store photos
    $photosStmt = $pdo->query("SELECT * FROM store_photos ORDER BY store_id ASC, sort_order ASC, id ASC");
    $photosGrouped = [];
    while ($row = $photosStmt->fetch()) {
        $photosGrouped[$row['store_id']][] = $row['image_url'];
    }

    $formatted = [];
    foreach ($stores as $s) {
        $sId = (int)$s['id'];
        $photos = $photosGrouped[$sId] ?? [];
        $formatted[] = [
            'id'             => (string)$sId,
            'numeric_id'     => $sId,
            'name'           => $s['name'],
            'room'           => $s['unit_number'] ?: '',
            'unit_number'    => $s['unit_number'] ?: '',
            'floor'          => $s['floor'],
            'category'       => $s['category'],
            'phone'          => $s['phone'] ?: '+254 790 964 002',
            'email'          => $s['email'] ?: 'info@mombasamall.co.ke',
            'website'        => $s['website'] ?: '',
            'socialMediaUrl' => $s['website'] ?: '',
            'socialHandle'   => metadata_get($pdo, 'stores', $sId)['socialHandle'] ?? '',
            'facebook' => metadata_get($pdo, 'stores', $sId)['facebook'] ?? '',
            'instagram' => metadata_get($pdo, 'stores', $sId)['instagram'] ?? '',
            'tiktok' => metadata_get($pdo, 'stores', $sId)['tiktok'] ?? '',
            'description'    => $s['description'] ?: '',
            'logoUrl'        => $s['logo_url'] ?: '/assets/Logo/Mall Logo/MOMBASA MALL 1.0.png',
            'logo_url'       => $s['logo_url'] ?: '',
            'photoUrls'      => $photos,
            'photos'         => $photos,
            'status'         => $s['status'],
            'isActive'       => $s['status'] === 'active',
            'sort_order'     => (int)$s['sort_order']
        ];
    }

    json_response([
        'success' => true,
        'count'   => count($formatted),
        'stores'  => $formatted
    ]);
}

// Handle POST (Create)
if ($method === 'POST') {
    $input = get_json_input();
    $name = trim($input['name'] ?? '');
    if ($name === '') json_response(['success'=>false,'error'=>'Store name is required.'],422);

    if (empty($name)) {
        json_response(['success' => false, 'error' => 'Store name is required'], 400);
    }

    $unitNumber = trim($input['room'] ?? $input['unit_number'] ?? '');
    $floor = $input['floor'] ?? 'Ground Floor';
    $floor = ['1st Floor'=>'First Floor','2nd Floor'=>'Second Floor','3rd Floor'=>'Third Floor','Basement'=>'Basement Parking'][$floor] ?? $floor;
    $category = $input['category'] ?? 'retail';
    if ($category === 'dining') $category = 'food';
    $phone = trim($input['phone'] ?? '+254 790 964 002');
    $email = trim($input['email'] ?? 'info@mombasamall.co.ke');
    $website = trim($input['website'] ?? $input['socialMediaUrl'] ?? '');
    $description = trim($input['description'] ?? '');
    $logoUrl = validate_media_url(trim($input['logoUrl'] ?? $input['logo_url'] ?? ''));
    $status = (!empty($input['isActive']) || ($input['status'] ?? '') === 'active') ? 'active' : 'inactive';
    $sortOrder = (int)($input['sort_order'] ?? 0);

    $pdo->beginTransaction();
    $stmt = $pdo->prepare("
        INSERT INTO stores (name, unit_number, floor, category, phone, email, website, description, logo_url, status, sort_order)
        VALUES (:name, :unit_number, :floor, :category, :phone, :email, :website, :description, :logo_url, :status, :sort_order)
    ");
    $stmt->execute([
        ':name'        => $name,
        ':unit_number' => $unitNumber,
        ':floor'       => $floor,
        ':category'    => $category,
        ':phone'       => $phone,
        ':email'       => $email,
        ':website'     => $website,
        ':description' => $description,
        ':logo_url'    => $logoUrl,
        ':status'      => $status,
        ':sort_order'  => $sortOrder
    ]);

    $storeId = (int)$pdo->lastInsertId();

    // Insert photos if any
    $photoUrls = $input['photoUrls'] ?? $input['photos'] ?? [];
    if (is_array($photoUrls)) {
        $pStmt = $pdo->prepare("INSERT INTO store_photos (store_id, image_url, caption, sort_order) VALUES (:store_id, :url, 'Storefront', :sort)");
        $sIdx = 1;
        foreach ($photoUrls as $url) {
            if (!empty($url)) {
                validate_media_url($url);
                $pStmt->execute([':store_id' => $storeId, ':url' => $url, ':sort' => $sIdx++]);
            }
        }
    }

    metadata_save($pdo, 'stores', $storeId, array_merge(metadata_get($pdo, 'stores', $storeId ?? $id), array_intersect_key($input, array_flip(['socialHandle','facebook','instagram','tiktok','photoFit']))));
    $pdo->commit();
    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'create_store', 'store', $storeId, "Created store: {$name}");

    json_response([
        'success' => true,
        'message' => 'Store created successfully',
        'store_id' => $storeId
    ], 201);
}

// Handle PUT (Update)
if ($method === 'PUT') {
    $input = get_json_input();
    $id = (int)($input['numeric_id'] ?? $input['id'] ?? 0);

    if ($id <= 0) {
        json_response(['success' => false, 'error' => 'Valid store ID is required'], 400);
    }
    require_existing($pdo, 'stores', $id);

    $name = trim($input['name'] ?? '');
    if ($name === '') json_response(['success'=>false,'error'=>'Store name is required.'],422);
    $unitNumber = trim($input['room'] ?? $input['unit_number'] ?? '');
    $floor = $input['floor'] ?? 'Ground Floor';
    $floor = ['1st Floor'=>'First Floor','2nd Floor'=>'Second Floor','3rd Floor'=>'Third Floor','Basement'=>'Basement Parking'][$floor] ?? $floor;
    $category = $input['category'] ?? 'retail';
    $phone = trim($input['phone'] ?? '+254 790 964 002');
    $email = trim($input['email'] ?? 'info@mombasamall.co.ke');
    $website = trim($input['website'] ?? $input['socialMediaUrl'] ?? '');
    $description = trim($input['description'] ?? '');
    $logoUrl = validate_media_url(trim($input['logoUrl'] ?? $input['logo_url'] ?? ''));
    $status = (!empty($input['isActive']) || ($input['status'] ?? '') === 'active') ? 'active' : 'inactive';
    $sortOrder = (int)($input['sort_order'] ?? 0);

    $pdo->beginTransaction();
    $stmt = $pdo->prepare("
        UPDATE stores SET
            name = :name,
            unit_number = :unit_number,
            floor = :floor,
            category = :category,
            phone = :phone,
            email = :email,
            website = :website,
            description = :description,
            logo_url = :logo_url,
            status = :status,
            sort_order = :sort_order
        WHERE id = :id
    ");
    $stmt->execute([
        ':name'        => $name,
        ':unit_number' => $unitNumber,
        ':floor'       => $floor,
        ':category'    => $category,
        ':phone'       => $phone,
        ':email'       => $email,
        ':website'     => $website,
        ':description' => $description,
        ':logo_url'    => $logoUrl,
        ':status'      => $status,
        ':sort_order'  => $sortOrder,
        ':id'          => $id
    ]);

    // Update photos if provided
    $photoUrls = $input['photoUrls'] ?? $input['photos'] ?? null;
    if (is_array($photoUrls)) {
        // Clear previous and replace
        $delP = $pdo->prepare("DELETE FROM store_photos WHERE store_id = :id");
        $delP->execute([':id' => $id]);

        $pStmt = $pdo->prepare("INSERT INTO store_photos (store_id, image_url, caption, sort_order) VALUES (:store_id, :url, 'Storefront', :sort)");
        $sIdx = 1;
        foreach ($photoUrls as $url) {
            if (!empty($url)) {
                validate_media_url($url);
                $pStmt->execute([':store_id' => $id, ':url' => $url, ':sort' => $sIdx++]);
            }
        }
    }

    metadata_save($pdo, 'stores', $id, ['socialHandle' => $input['socialHandle'] ?? '']);
    $pdo->commit();
    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'update_store', 'store', $id, "Updated store ID: {$id}");

    json_response([
        'success' => true,
        'message' => 'Store updated successfully'
    ]);
}

// Handle DELETE
if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        $input = get_json_input();
        $id = (int)($input['id'] ?? 0);
    }

    if ($id <= 0) {
        json_response(['success' => false, 'error' => 'Valid store ID is required'], 400);
    }
    require_existing($pdo, 'stores', $id);

    $pdo->beginTransaction();
    $stmt = $pdo->prepare("DELETE FROM stores WHERE id = :id");
    $stmt->execute([':id' => $id]);

    $pdo->commit();
    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'delete_store', 'store', $id, "Deleted store ID: {$id}");

    json_response([
        'success' => true,
        'message' => 'Store deleted successfully'
    ]);
}

json_response(['success' => false, 'error' => 'Method not allowed'], 405);
