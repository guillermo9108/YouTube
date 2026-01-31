<?php
define('MARKET_DIR', 'uploads/market/');

function market_get_items($pdo) {
    $sql = "SELECT m.*, u.username as sellerName, u.avatarUrl as sellerAvatarUrl,
            (SELECT AVG(rating) FROM marketplace_reviews WHERE itemId = m.id) as rating,
            (SELECT COUNT(*) FROM marketplace_reviews WHERE itemId = m.id) as reviewCount
            FROM marketplace_items m 
            LEFT JOIN users u ON m.sellerId = u.id 
            WHERE m.status IN ('ACTIVO', 'AGOTADO')
            ORDER BY m.createdAt DESC";
    $stmt = $pdo->query($sql);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($items as &$i) {
        $imgs = json_decode($i['images'], true);
        $i['images'] = is_array($imgs) ? array_map('fix_url', $imgs) : [];
        if (isset($i['sellerAvatarUrl'])) $i['sellerAvatarUrl'] = fix_url($i['sellerAvatarUrl']);
        $i['rating'] = $i['rating'] ? round($i['rating'], 1) : 0;
    }
    respond(true, $items);
}

function market_get_item($pdo, $id) {
    $stmt = $pdo->prepare("SELECT m.*, u.username as sellerName, u.avatarUrl as sellerAvatarUrl,
            (SELECT AVG(rating) FROM marketplace_reviews WHERE itemId = m.id) as rating,
            (SELECT COUNT(*) FROM marketplace_reviews WHERE itemId = m.id) as reviewCount
            FROM marketplace_items m LEFT JOIN users u ON m.sellerId = u.id WHERE m.id = ?");
    $stmt->execute([$id]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($item) {
        $imgs = json_decode($item['images'], true);
        $item['images'] = is_array($imgs) ? array_map('fix_url', $imgs) : [];
        if (isset($item['sellerAvatarUrl'])) $item['sellerAvatarUrl'] = fix_url($item['sellerAvatarUrl']);
        $item['rating'] = $item['rating'] ? round($item['rating'], 1) : 0;
        respond(true, $item);
    }
    respond(false, null, 'Artículo no encontrado');
}

function market_create_listing($pdo, $post, $files) {
    $id = 'm_' . uniqid();
    $price = floatval($post['price']);
    $images = [];
    if (!is_dir(MARKET_DIR)) mkdir(MARKET_DIR, 0777, true);
    if (isset($files['images'])) {
        foreach ($files['images']['tmp_name'] as $key => $tmp_name) {
            if ($files['images']['error'][$key] === UPLOAD_ERR_OK) {
                $ext = strtolower(pathinfo($files['images']['name'][$key], PATHINFO_EXTENSION));
                $name = "{$id}_{$key}.{$ext}";
                if (move_uploaded_file($tmp_name, MARKET_DIR . $name)) $images[] = "api/" . MARKET_DIR . $name;
            }
        }
    }
    $stmt = $pdo->prepare("INSERT INTO marketplace_items (id, title, description, price, originalPrice, stock, images, sellerId, category, itemCondition, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO', ?)");
    $stmt->execute([$id, $post['title'], $post['description'], $price, $price, intval($post['stock']), json_encode($images), $post['sellerId'], $post['category'], $post['condition'], time()]);
    respond(true);
}

function market_edit_listing($pdo, $input) {
    $id = $input['id'];
    $data = $input['data'];
    $allowed = ['price', 'originalPrice', 'discountPercent', 'stock', 'title', 'description'];
    $fields = []; $params = [];
    foreach ($data as $k => $v) {
        if (in_array($k, $allowed)) {
            $fields[] = "`$k` = ?";
            $params[] = $v;
        }
    }
    if (empty($fields)) respond(true);
    $params[] = $id;
    $pdo->prepare("UPDATE marketplace_items SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
    respond(true);
}

function market_checkout($pdo, $input) {
    $userId = $input['userId'];
    $pdo->beginTransaction();
    try {
        $rate = ($s = $pdo->query("SELECT marketCommission FROM system_settings LIMIT 1")->fetch()) ? (floatval($s['marketCommission'])/100) : 0.25;
        $adminId = $pdo->query("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1")->fetchColumn();
        foreach ($input['cart'] as $item) {
            $qty = intval($item['quantity'] ?? 1);
            $stmt = $pdo->prepare("SELECT price, sellerId, stock FROM marketplace_items WHERE id = ? FOR UPDATE");
            $stmt->execute([$item['id']]);
            $real = $stmt->fetch();
            if ($real['stock'] < $qty) throw new Exception("Stock insuficiente");
            $total = floatval($real['price']) * $qty;
            $fee = $total * $rate;
            $pdo->prepare("UPDATE users SET balance = balance - ? WHERE id = ?")->execute([$total, $userId]);
            $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$total - $fee, $real['sellerId']]);
            if ($adminId) $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$fee, $adminId]);
            $pdo->prepare("UPDATE marketplace_items SET stock = stock - ? WHERE id = ?")->execute([$qty, $item['id']]);
            $pdo->prepare("INSERT INTO transactions (id, buyerId, creatorId, marketplaceItemId, amount, adminFee, timestamp, type, shippingData, isExternal) VALUES (?, ?, ?, ?, ?, ?, ?, 'MARKETPLACE', ?, 0)")
                ->execute([uniqid('txm_'), $userId, $real['sellerId'], $item['id'], $total, $fee, time(), json_encode($input['shippingDetails'])]);
        }
        $pdo->commit(); respond(true);
    } catch (Exception $e) { $pdo->rollBack(); respond(false, null, $e->getMessage()); }
}

function market_add_review($pdo, $input) {
    $pdo->prepare("INSERT INTO marketplace_reviews (id, itemId, userId, rating, comment, timestamp) VALUES (?, ?, ?, ?, ?, ?)")
        ->execute([uniqid('rv_'), $input['itemId'], $input['userId'], $input['rating'], $input['comment'], time()]);
    respond(true);
}

function market_get_reviews($pdo, $itemId) {
    $stmt = $pdo->prepare("SELECT r.*, u.username, u.avatarUrl as userAvatarUrl FROM marketplace_reviews r LEFT JOIN users u ON r.userId = u.id WHERE r.itemId = ? ORDER BY r.timestamp DESC");
    $stmt->execute([$itemId]);
    $reviews = $stmt->fetchAll();
    foreach($reviews as &$r) $r['userAvatarUrl'] = fix_url($r['userAvatarUrl']);
    respond(true, $reviews);
}

function market_admin_delete_listing($pdo, $input) {
    $pdo->prepare("UPDATE marketplace_items SET status = 'ELIMINADO' WHERE id = ?")->execute([$input['id']]);
    respond(true);
}

function market_admin_get_items($pdo) {
    $stmt = $pdo->query("SELECT m.*, u.username as sellerName FROM marketplace_items m LEFT JOIN users u ON m.sellerId = u.id ORDER BY m.createdAt DESC");
    $items = $stmt->fetchAll();
    foreach ($items as &$i) {
        $imgs = json_decode($i['images'], true);
        $i['images'] = is_array($imgs) ? array_map('fix_url', $imgs) : [];
    }
    respond(true, $items);
}
?>