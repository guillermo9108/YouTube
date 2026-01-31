<?php
function interact_get_all_requests($pdo) {
    $stmt = $pdo->query("SELECT r.*, u.username FROM requests r JOIN users u ON r.userId = u.id ORDER BY r.createdAt DESC");
    respond(true, $stmt->fetchAll());
}

function interact_request_content($pdo, $input) {
    $pdo->prepare("INSERT INTO requests (id, userId, query, status, createdAt, isVip) VALUES (?, ?, ?, 'PENDING', ?, ?)")
        ->execute([uniqid('req_'), $input['userId'], $input['query'], time(), ($input['isVip'] ?? 0) ? 1 : 0]);
    respond(true);
}

function interact_update_request_status($pdo, $input) {
    $pdo->prepare("UPDATE requests SET status = ? WHERE id = ?")->execute([$input['status'], $input['id']]);
    respond(true);
}

function interact_delete_request($pdo, $input) {
    $pdo->prepare("DELETE FROM requests WHERE id = ?")->execute([$input['id']]);
    respond(true);
}

function interact_submit_manual_vip_request($pdo, $post, $files) {
    $id = uniqid('mvr_');
    $proofUrl = null;
    if (isset($files['proofImage']) && $files['proofImage']['error'] === UPLOAD_ERR_OK) {
        $ext = strtolower(pathinfo($files['proofImage']['name'], PATHINFO_EXTENSION));
        $name = "proof_{$id}.{$ext}";
        if (!is_dir('uploads/proofs/')) mkdir('uploads/proofs/', 0777, true);
        move_uploaded_file($files['proofImage']['tmp_name'], 'uploads/proofs/' . $name);
        $proofUrl = 'api/uploads/proofs/' . $name;
    }
    $pdo->prepare("INSERT INTO vip_requests (id, userId, planSnapshot, proofText, proofImageUrl, status, createdAt) VALUES (?, ?, ?, ?, ?, 'PENDING', ?)")
        ->execute([$id, $post['userId'], $post['planSnapshot'], $post['proofText'], $proofUrl, time()]);
    respond(true);
}

function admin_handle_balance_request($pdo, $input) {
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("SELECT * FROM balance_requests WHERE id = ? AND status = 'PENDING' FOR UPDATE");
        $stmt->execute([$input['reqId']]);
        $req = $stmt->fetch();
        if ($req && $input['status'] === 'APPROVED') {
            $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$req['amount'], $req['userId']]);
            $pdo->prepare("INSERT INTO transactions (id, buyerId, amount, type, timestamp, videoTitle, isExternal) VALUES (?, ?, ?, 'DEPOSIT', ?, 'Recarga aprobada', 1)")
                ->execute([uniqid('tx_dep_'), $req['userId'], $req['amount'], time()]);
        }
        $pdo->prepare("UPDATE balance_requests SET status = ? WHERE id = ?")->execute([$input['status'], $input['reqId']]);
        $pdo->commit(); respond(true);
    } catch (Exception $e) { $pdo->rollBack(); respond(false, null, $e->getMessage()); }
}
?>