<?php
// index.php - API Principal para StreamPay

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Constantes
define('UPLOAD_DIR', '../uploads/videos/');
define('VIDEO_PLACEHOLDER_URL', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4');
define('THUMBNAIL_PLACEHOLDER_URL', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80');

// Cargar Configuración
$configFile = 'db_config.json';
if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'System not installed. Config missing.']);
    exit();
}

$db_config = json_decode(file_get_contents($configFile), true);

function respond($success, $data = null, $error = null) {
    header('Content-Type: application/json');
    if ($success) {
        echo json_encode(['success' => true, 'data' => $data]);
    } else {
        // http_response_code(400); // Optional: keep 200 OK but return success: false for frontend handling
        echo json_encode(['success' => false, 'error' => $error ?? 'Operation failed']);
    }
    exit();
}

// Conexión DB
try {
    $dsn = "mysql:host={$db_config['host']};port={$db_config['port']};dbname={$db_config['name']}";
    $pdo = new PDO($dsn, $db_config['user'], $db_config['password']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    respond(false, null, 'Database connection error');
}

// --- Helper Functions ---

function get_user_by_id($pdo, $id) {
    $stmt = $pdo->prepare("SELECT id, username, role, balance, autoPurchaseLimit, watchLater FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($user) {
        $user['balance'] = (float)$user['balance'];
        $user['autoPurchaseLimit'] = (float)$user['autoPurchaseLimit'];
        $user['watchLater'] = json_decode($user['watchLater'] ?? '[]');
    }
    return $user;
}

function get_video_by_id($pdo, $id) {
    $stmt = $pdo->prepare("SELECT v.*, u.username as creatorName FROM videos v LEFT JOIN users u ON v.creatorId = u.id WHERE v.id = ?");
    $stmt->execute([$id]);
    $video = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($video) {
        $video['price'] = (float)$video['price'];
        $video['views'] = (int)$video['views'];
        $video['likes'] = (int)$video['likes'];
        $video['dislikes'] = (int)$video['dislikes'];
        $video['createdAt'] = (int)$video['createdAt'];
    }
    return $video;
}

// --- Router ---

$action = $_GET['action'] ?? null;
$input = json_decode(file_get_contents('php://input'), true);

// Support FormData
if (!$input && !empty($_POST)) {
    $input = $_POST;
}

switch ($action) {
    case 'login':
        $username = $input['username'] ?? '';
        $password = $input['password'] ?? '';

        $stmt = $pdo->prepare("SELECT id, username, password_hash, role, balance, autoPurchaseLimit, watchLater FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && password_verify($password, $user['password_hash'])) {
            unset($user['password_hash']);
            $user['balance'] = (float)$user['balance'];
            $user['autoPurchaseLimit'] = (float)$user['autoPurchaseLimit'];
            $user['watchLater'] = json_decode($user['watchLater'] ?? '[]');
            respond(true, $user);
        } else {
            respond(false, null, 'Invalid credentials.');
        }
        break;

    case 'register':
        $username = $input['username'] ?? '';
        $password = $input['password'] ?? '';

        if (empty($username) || empty($password)) respond(false, null, 'Username and password required.');

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE username = ?");
        $stmt->execute([$username]);
        if ($stmt->fetchColumn() > 0) respond(false, null, 'Username taken.');

        $id = 'u_' . uniqid();
        $password_hash = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare("INSERT INTO users (id, username, password_hash, role, balance, autoPurchaseLimit, watchLater) VALUES (?, ?, ?, 'USER', 100.00, 1.00, '[]')");
        $stmt->execute([$id, $username, $password_hash]);

        respond(true, get_user_by_id($pdo, $id));
        break;

    case 'get_user':
        $id = $_GET['id'] ?? null;
        if (!$id) respond(false, null, 'User ID required.');
        $user = get_user_by_id($pdo, $id);
        if (!$user) respond(false, null, 'User not found.');
        respond(true, $user);
        break;

    case 'get_videos':
        $stmt = $pdo->query("SELECT v.*, u.username as creatorName FROM videos v LEFT JOIN users u ON v.creatorId = u.id ORDER BY v.createdAt DESC");
        $videos = $stmt->fetchAll(PDO::FETCH_ASSOC);
        // Type casting
        foreach($videos as &$v) {
            $v['price'] = (float)$v['price'];
            $v['views'] = (int)$v['views'];
            $v['likes'] = (int)$v['likes'];
            $v['dislikes'] = (int)$v['dislikes'];
            $v['createdAt'] = (int)$v['createdAt'];
        }
        respond(true, $videos);
        break;

    case 'get_video':
        $id = $_GET['id'] ?? null;
        if (!$id) respond(false, null, 'Video ID required.');
        $video = get_video_by_id($pdo, $id);
        if (!$video) respond(false, null, 'Video not found.');
        respond(true, $video);
        break;

    case 'has_purchased':
        $userId = $_GET['userId'] ?? null;
        $videoId = $_GET['videoId'] ?? null;
        if (!$userId || !$videoId) respond(false, null, 'Missing params.');

        // Check if user is creator
        $v = get_video_by_id($pdo, $videoId);
        if ($v && $v['creatorId'] === $userId) {
            respond(true, ['hasPurchased' => true]);
        }

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM transactions WHERE buyerId = ? AND videoId = ? AND type = 'PURCHASE'");
        $stmt->execute([$userId, $videoId]);
        $has = $stmt->fetchColumn() > 0;
        respond(true, ['hasPurchased' => $has]);
        break;

    case 'purchase_video':
        $userId = $input['userId'] ?? null;
        $videoId = $input['videoId'] ?? null;

        if (!$userId || !$videoId) respond(false, null, 'Missing params.');

        $user = get_user_by_id($pdo, $userId);
        $video = get_video_by_id($pdo, $videoId);

        if (!$user || !$video) respond(false, null, 'User or Video not found.');
        if ($user['id'] === $video['creatorId']) respond(true); // Creator owns it
        if ($user['balance'] < $video['price']) respond(false, null, 'Insufficient balance.');

        // Check if already purchased
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM transactions WHERE buyerId = ? AND videoId = ? AND type = 'PURCHASE'");
        $stmt->execute([$userId, $videoId]);
        if ($stmt->fetchColumn() > 0) respond(true);

        try {
            $pdo->beginTransaction();

            // Deduct from buyer
            $pdo->prepare("UPDATE users SET balance = balance - ? WHERE id = ?")
                ->execute([$video['price'], $userId]);

            // Add to creator
            $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")
                ->execute([$video['price'], $video['creatorId']]);

            // Transaction Record
            $txId = 'tx_' . uniqid();
            $pdo->prepare("INSERT INTO transactions (id, buyerId, creatorId, videoId, amount, timestamp, type) VALUES (?, ?, ?, ?, ?, ?, 'PURCHASE')")
                ->execute([$txId, $userId, $video['creatorId'], $videoId, $video['price'], time() * 1000]);

            $pdo->commit();
            respond(true);
        } catch (Exception $e) {
            $pdo->rollBack();
            respond(false, null, 'Purchase failed: ' . $e->getMessage());
        }
        break;

    case 'upload_video':
        $title = $_POST['title'] ?? null;
        $description = $_POST['description'] ?? null;
        $price = (float)($_POST['price'] ?? 0);
        $creatorId = $_POST['creatorId'] ?? null;
        $file = $_FILES['video'] ?? null;

        if (!$title || !$creatorId) respond(false, null, 'Missing fields.');

        $videoUrl = VIDEO_PLACEHOLDER_URL;
        $thumbnailUrl = THUMBNAIL_PLACEHOLDER_URL;

        if ($file && $file['error'] === UPLOAD_ERR_OK) {
            if (!file_exists(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0777, true);

            $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
            $fileName = uniqid('vid_') . '.' . $ext;
            $targetPath = UPLOAD_DIR . $fileName;

            if (move_uploaded_file($file['tmp_name'], $targetPath)) {
                // Return relative path for frontend
                $videoUrl = '/api/uploads/videos/' . $fileName; 
            }
        }

        $videoId = 'v_' . uniqid();
        $stmt = $pdo->prepare("INSERT INTO videos (id, title, description, price, thumbnailUrl, videoUrl, creatorId, views, createdAt, likes, dislikes) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 0)");
        $stmt->execute([
            $videoId, $title, $description, $price, $thumbnailUrl, $videoUrl, $creatorId, time() * 1000
        ]);

        respond(true, ['message' => 'Video uploaded.']);
        break;

    case 'toggle_watch_later':
        $userId = $input['userId'] ?? null;
        $videoId = $input['videoId'] ?? null;
        if (!$userId || !$videoId) respond(false, null, 'Missing params.');

        $user = get_user_by_id($pdo, $userId);
        $list = $user['watchLater'];

        $key = array_search($videoId, $list);
        if ($key !== false) {
            array_splice($list, $key, 1);
        } else {
            $list[] = $videoId;
        }

        $pdo->prepare("UPDATE users SET watchLater = ? WHERE id = ?")
            ->execute([json_encode(array_values($list)), $userId]);

        respond(true, ['list' => $list]);
        break;

    case 'get_comments':
        $videoId = $_GET['videoId'] ?? null;
        if (!$videoId) respond(false, null, 'Video ID required.');

        $stmt = $pdo->prepare("SELECT c.id, c.videoId, c.userId, u.username, c.text, c.timestamp FROM comments c JOIN users u ON c.userId = u.id WHERE c.videoId = ? ORDER BY c.timestamp DESC");
        $stmt->execute([$videoId]);
        $comments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach($comments as &$c) {
            $c['timestamp'] = (int)$c['timestamp'];
        }
        respond(true, $comments);
        break;

    case 'add_comment':
        $userId = $input['userId'] ?? null;
        $videoId = $input['videoId'] ?? null;
        $text = $input['text'] ?? null;

        if (!$userId || !$videoId || !$text) respond(false, null, 'Missing data.');

        $commentId = 'c_' . uniqid();
        $timestamp = time() * 1000;

        $pdo->prepare("INSERT INTO comments (id, videoId, userId, text, timestamp) VALUES (?, ?, ?, ?, ?)")
            ->execute([$commentId, $videoId, $userId, $text, $timestamp]);

        $user = get_user_by_id($pdo, $userId);
        respond(true, ['id' => $commentId, 'videoId' => $videoId, 'userId' => $userId, 'username' => $user['username'], 'text' => $text, 'timestamp' => $timestamp]);
        break;

    case 'admin_add_balance':
        $adminId = $input['adminId'] ?? null;
        $targetUserId = $input['targetUserId'] ?? null;
        $amount = (float)($input['amount'] ?? 0);

        $admin = get_user_by_id($pdo, $adminId);
        if (!$admin || $admin['role'] !== 'ADMIN') respond(false, null, 'Unauthorized.');

        $pdo->beginTransaction();
        $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$amount, $targetUserId]);

        $txId = 'tx_' . uniqid();
        $pdo->prepare("INSERT INTO transactions (id, buyerId, creatorId, videoId, amount, timestamp, type) VALUES (?, ?, NULL, NULL, ?, ?, 'DEPOSIT')")
            ->execute([$txId, $adminId, $amount, time() * 1000]); // Admin is "buyer" (sender) in deposit

        $pdo->commit();
        respond(true);
        break;

    case 'get_interaction':
        $userId = $_GET['userId'] ?? null;
        $videoId = $_GET['videoId'] ?? null;

        $stmt = $pdo->prepare("SELECT liked, disliked, isWatched FROM interactions WHERE userId = ? AND videoId = ?");
        $stmt->execute([$userId, $videoId]);
        $res = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$res) {
            $res = ['liked' => false, 'disliked' => false, 'isWatched' => false, 'userId' => $userId, 'videoId' => $videoId];
        } else {
            $res['liked'] = (bool)$res['liked'];
            $res['disliked'] = (bool)$res['disliked'];
            $res['isWatched'] = (bool)$res['isWatched'];
            $res['userId'] = $userId;
            $res['videoId'] = $videoId;
        }
        respond(true, $res);
        break;

    case 'toggle_like':
        $userId = $input['userId'] ?? null;
        $videoId = $input['videoId'] ?? null;
        $isLike = $input['isLike'] ?? true;

        // Upsert interaction
        $stmt = $pdo->prepare("SELECT * FROM interactions WHERE userId = ? AND videoId = ?");
        $stmt->execute([$userId, $videoId]);
        $current = $stmt->fetch(PDO::FETCH_ASSOC);

        $liked = $current ? (bool)$current['liked'] : false;

        if ($isLike) {
            $liked = !$liked;
        }

        if ($current) {
            $pdo->prepare("UPDATE interactions SET liked = ? WHERE userId = ? AND videoId = ?")
                ->execute([$liked ? 1 : 0, $userId, $videoId]);
        } else {
            $pdo->prepare("INSERT INTO interactions (userId, videoId, liked, disliked, isWatched) VALUES (?, ?, ?, 0, 0)")
                ->execute([$userId, $videoId, $liked ? 1 : 0]);
        }

        // Recalc video stats
        $pdo->prepare("UPDATE videos SET likes = (SELECT COUNT(*) FROM interactions WHERE videoId = ? AND liked = 1) WHERE id = ?")
            ->execute([$videoId, $videoId]);

        // Return updated interaction
        $stmt = $pdo->prepare("SELECT liked, disliked, isWatched FROM interactions WHERE userId = ? AND videoId = ?");
        $stmt->execute([$userId, $videoId]);
        $res = $stmt->fetch(PDO::FETCH_ASSOC);
        $res['liked'] = (bool)$res['liked'];
        $res['disliked'] = (bool)$res['disliked'];
        $res['isWatched'] = (bool)$res['isWatched'];

        respond(true, $res);
        break;

    case 'mark_watched':
        $userId = $input['userId'] ?? null;
        $videoId = $input['videoId'] ?? null;

        $stmt = $pdo->prepare("SELECT * FROM interactions WHERE userId = ? AND videoId = ?");
        $stmt->execute([$userId, $videoId]);
        if ($stmt->fetch()) {
             $pdo->prepare("UPDATE interactions SET isWatched = 1 WHERE userId = ? AND videoId = ?")->execute([$userId, $videoId]);
        } else {
             $pdo->prepare("INSERT INTO interactions (userId, videoId, liked, disliked, isWatched) VALUES (?, ?, 0, 0, 1)")->execute([$userId, $videoId]);
        }

        $pdo->prepare("UPDATE videos SET views = views + 1 WHERE id = ?")->execute([$videoId]);
        respond(true);
        break;

    case 'update_user':
        $userId = $input['userId'] ?? null;
        $updates = $input['updates'] ?? [];

        if (isset($updates['autoPurchaseLimit'])) {
            $pdo->prepare("UPDATE users SET autoPurchaseLimit = ? WHERE id = ?")
                ->execute([$updates['autoPurchaseLimit'], $userId]);
        }
        respond(true);
        break;

    case 'update_prices_bulk':
        $creatorId = $input['creatorId'] ?? null;
        $newPrice = $input['newPrice'] ?? null;

        if ($creatorId && $newPrice !== null) {
            $pdo->prepare("UPDATE videos SET price = ? WHERE creatorId = ?")->execute([$newPrice, $creatorId]);
            respond(true);
        } else {
            respond(false);
        }
        break;

    case 'get_all_users':
        $stmt = $pdo->query("SELECT id, username, role, balance FROM users");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach($users as &$u) {
            $u['balance'] = (float)$u['balance'];
        }
        respond(true, $users);
        break;

    case 'get_transactions':
        $userId = $_GET['userId'] ?? null;
        $stmt = $pdo->prepare("SELECT * FROM transactions WHERE buyerId = ? OR creatorId = ? ORDER BY timestamp DESC");
        $stmt->execute([$userId, $userId]);
        $txs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach($txs as &$t) {
            $t['amount'] = (float)$t['amount'];
            $t['timestamp'] = (int)$t['timestamp'];
        }
        respond(true, $txs);
        break;

    case 'get_creator_videos':
        $creatorId = $_GET['creatorId'] ?? null;
        $stmt = $pdo->prepare("SELECT * FROM videos WHERE creatorId = ?");
        $stmt->execute([$creatorId]);
        $videos = $stmt->fetchAll(PDO::FETCH_ASSOC);
        respond(true, $videos);
        break;

    case 'get_related_videos':
        $id = $_GET['id'] ?? null;
        // Simple random strategy for now, excluding current
        $stmt = $pdo->prepare("SELECT v.*, u.username as creatorName FROM videos v LEFT JOIN users u ON v.creatorId = u.id WHERE v.id != ? ORDER BY RAND() LIMIT 5");
        $stmt->execute([$id]);
        $videos = $stmt->fetchAll(PDO::FETCH_ASSOC);
        respond(true, $videos);
        break;

    default:
        respond(false, null, 'Invalid action');
}
?>