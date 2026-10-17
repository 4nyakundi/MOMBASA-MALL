<?php
/**
 * Mombasa Mall - Blog & News API
 */

require_once __DIR__ . '/../config.php';

authorize_resource('blog');
$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];

// Handle GET
if ($method === 'GET') {
    $status = $_GET['status'] ?? null;
    $sql = "SELECT * FROM blog_posts WHERE 1=1";
    $params = [];

    if ($status) {
        $sql .= " AND status = :status";
        $params[':status'] = $status;
    }

    $sql .= " ORDER BY published_date DESC, id DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $posts = $stmt->fetchAll();

    $formatted = [];
    foreach ($posts as $p) {
        $formatted[] = [
            'id'             => (string)$p['id'],
            'numeric_id'     => (int)$p['id'],
            'title'          => $p['title'],
            'slug'           => $p['slug'],
            'excerpt'        => $p['excerpt'] ?: '',
            'body'           => $p['body'] ?: '',
            'content'        => $p['body'] ?: '',
            'author'         => $p['author'] ?: 'Mombasa Mall Editorial',
            'date'           => $p['published_date'] ?: date('Y-m-d', strtotime($p['created_at'])),
            'published_date' => $p['published_date'],
            'imageUrl'       => $p['image_url'] ?: '',
            'image'          => $p['image_url'] ?: '',
            'status'         => $p['status']
        ];
    }

    json_response([
        'success' => true,
        'count'   => count($formatted),
        'posts'   => $formatted
    ]);
}

// Handle POST (Create)
if ($method === 'POST') {
    $input = get_json_input();
    $title = trim($input['title'] ?? '');
    if (empty($title)) {
        json_response(['success' => false, 'error' => 'Post title is required'], 400);
    }

    $slug = trim($input['slug'] ?? '');
    if (empty($slug)) {
        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $title), '-'));
    }

    $excerpt = trim($input['excerpt'] ?? '');
    $body = trim($input['body'] ?? $input['content'] ?? '');
    $author = trim($input['author'] ?? 'Mombasa Mall Editorial');
    $publishedDate = trim($input['date'] ?? $input['published_date'] ?? date('Y-m-d'));
    $imageUrl = trim($input['imageUrl'] ?? $input['image'] ?? $input['image_url'] ?? '');
    $status = ($input['status'] ?? 'published') === 'draft' ? 'draft' : 'published';

    $stmt = $pdo->prepare("
        INSERT INTO blog_posts (title, slug, excerpt, body, image_url, author, published_date, status, created_by)
        VALUES (:title, :slug, :excerpt, :body, :image_url, :author, :published_date, :status, :created_by)
    ");
    $stmt->execute([
        ':title'          => $title,
        ':slug'           => $slug,
        ':excerpt'        => $excerpt,
        ':body'           => $body,
        ':image_url'      => $imageUrl,
        ':author'         => $author,
        ':published_date' => $publishedDate,
        ':status'         => $status,
        ':created_by'     => $_SESSION['admin_user']['id'] ?? 1
    ]);

    $postId = (int)$pdo->lastInsertId();
    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'create_blog', 'blog_post', $postId, "Created blog post: {$title}");

    json_response([
        'success' => true,
        'message' => 'Post created successfully',
        'post_id' => $postId
    ], 201);
}

// Handle PUT (Update)
if ($method === 'PUT') {
    $input = get_json_input();
    $id = (int)($input['numeric_id'] ?? $input['id'] ?? 0);
    if ($id <= 0) {
        json_response(['success' => false, 'error' => 'Valid post ID is required'], 400);
    }
    require_existing($pdo, 'blog_posts', $id);

    $title = trim($input['title'] ?? '');
    $slug = trim($input['slug'] ?? '');
    if (empty($slug) && !empty($title)) {
        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $title), '-'));
    }
    $excerpt = trim($input['excerpt'] ?? '');
    $body = trim($input['body'] ?? $input['content'] ?? '');
    $author = trim($input['author'] ?? 'Mombasa Mall Editorial');
    $publishedDate = trim($input['date'] ?? $input['published_date'] ?? date('Y-m-d'));
    $imageUrl = trim($input['imageUrl'] ?? $input['image'] ?? $input['image_url'] ?? '');
    $status = ($input['status'] ?? 'published') === 'draft' ? 'draft' : 'published';

    $stmt = $pdo->prepare("
        UPDATE blog_posts SET
            title = :title,
            slug = :slug,
            excerpt = :excerpt,
            body = :body,
            image_url = :image_url,
            author = :author,
            published_date = :published_date,
            status = :status
        WHERE id = :id
    ");
    $stmt->execute([
        ':title'          => $title,
        ':slug'           => $slug,
        ':excerpt'        => $excerpt,
        ':body'           => $body,
        ':image_url'      => $imageUrl,
        ':author'         => $author,
        ':published_date' => $publishedDate,
        ':status'         => $status,
        ':id'             => $id
    ]);

    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'update_blog', 'blog_post', $id, "Updated blog post ID: {$id}");

    json_response([
        'success' => true,
        'message' => 'Post updated successfully'
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
        json_response(['success' => false, 'error' => 'Valid post ID is required'], 400);
    }
    require_existing($pdo, 'blog_posts', $id);

    $stmt = $pdo->prepare("DELETE FROM blog_posts WHERE id = :id");
    $stmt->execute([':id' => $id]);

    log_activity($pdo, $_SESSION['admin_user']['id'] ?? null, 'delete_blog', 'blog_post', $id, "Deleted blog post ID: {$id}");

    json_response([
        'success' => true,
        'message' => 'Post deleted successfully'
    ]);
}

json_response(['success' => false, 'error' => 'Method not allowed'], 405);
