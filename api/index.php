<?php
// index.php

// Constantes y archivos de configuración
define('UPLOAD_DIR', 'uploads/videos/');
define('VIDEO_PLACEHOLDER_URL', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4');
define('THUMBNAIL_PLACEHOLDER_URL', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80');

// Cargar configuración de DB
$db_config = json_decode(file_get_contents('db_config.json'), true);

// Función de respuesta JSON uniforme
function respond($success, $data = null, $error = null) {
    header('Content-Type: application/json');
    // Si la respuesta es JSON, envuelve los datos en el formato esperado por db.ts
    if ($success) {
        echo json_encode(['success' => true, 'data' => $data]);
    } else {
        http_response_code(400); // Bad Request o Internal Server Error
        echo json_encode(['success' => false, 'error' => $error ?? 'Operation failed']);
    }
    exit();
}

// Conexión a MariaDB
try {
    $pdo = new PDO(
        "mysql:host={$db_config['host']};dbname={$db_config['name']}",
        $db_config['user'],
        $db_config['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    respond(false, null, 'Database connection error: ' . $e->getMessage());
}

// --- Helper Functions ---

function get_user_by_id($pdo, $id) {
    $stmt = $pdo->prepare("SELECT id, username, role, balance, autoPurchaseLimit, watchLater FROM users WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function get_video_by_id($pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM videos WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

// --- Lógica Principal ---
$action = $_GET['action'] ?? null;
$input = json_decode(file_get_contents('php://input'), true);

switch ($action) {
    case 'login':
        $username = $input['username'] ?? '';
        $password = $input['password'] ?? '';
        
        $stmt = $pdo->prepare("SELECT id, username, password_hash, role, balance, autoPurchaseLimit, watchLater FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && password_verify($password, $user['password_hash'])) {
            // Eliminar el hash antes de enviar
            unset($user['password_hash']); 
            // Convertir watchLater de string JSON a array
            $user['watchLater'] = $user['watchLater'] ? json_decode($user['watchLater']) : [];
            respond(true, $user);
        } else {
            respond(false, null, 'Invalid credentials.');
        }
        break;

    case 'register':
        $username = $input['username'] ?? '';
        $password = $input['password'] ?? '';
        
        if (empty($username) || empty($password)) respond(false, null, 'Username and password required.');

        // Verificar si el nombre de usuario está tomado
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
        $user['watchLater'] = $user['watchLater'] ? json_decode($user['watchLater']) : [];
        respond(true, $user);
        break;
        
    case 'get_videos':
        // Obtener todos los videos
        $stmt = $pdo->query("SELECT * FROM videos ORDER BY createdAt DESC");
        respond(true, $stmt->fetchAll(PDO::FETCH_ASSOC));
        break;

    case 'get_video':
        // Obtener un video por ID
        $id = $_GET['id'] ?? null;
        if (!$id) respond(false, null, 'Video ID required.');
        $video = get_video_by_id($pdo, $id);
        if (!$video) respond(false, null, 'Video not found.');
        respond(true, $video);
        break;

    case 'has_purchased':
        $userId = $_GET['userId'] ?? null;
        $videoId = $_GET['videoId'] ?? null;
        if (!$userId || !$videoId) respond(false, null, 'User ID and Video ID required.');
        
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM transactions WHERE buyerId = ? AND videoId = ? AND type = 'PURCHASE'");
        $stmt->execute([$userId, $videoId]);
        $has = $stmt->fetchColumn() > 0;
        respond(true, ['hasPurchased' => $has]);
        break;

    case 'purchase_video':
        $userId = $input['userId'] ?? null;
        $videoId = $input['videoId'] ?? null;

        if (!$userId || !$videoId) respond(false, null, 'User ID and Video ID required.');

        $user = get_user_by_id($pdo, $userId);
        $video = get_video_by_id($pdo, $videoId);

        if (!$user || !$video) respond(false, null, 'User or Video not found.');
        if ($user['balance'] < $video['price']) respond(false, null, 'Insufficient balance.');
        
        try {
            $pdo->beginTransaction();
            
            // 1. Descontar del comprador
            $pdo->prepare("UPDATE users SET balance = balance - ? WHERE id = ?")
                ->execute([$video['price'], $userId]);
            
            // 2. Crear transacción
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
        $price = (int)($_POST['price'] ?? 0);
        $creatorId = $_POST['creatorId'] ?? null;
        $file = $_FILES['video'] ?? null;

        if (!$title || !$creatorId) respond(false, null, 'Missing required fields.');
        
        $user = get_user_by_id($pdo, $creatorId);
        if (!$user) respond(false, null, 'Creator not found.');

        $videoUrl = VIDEO_PLACEHOLDER_URL; // Por defecto
        $thumbnailUrl = THUMBNAIL_PLACEHOLDER_URL; // Por defecto

        if ($file && $file['error'] === UPLOAD_ERR_OK) {
            $fileName = uniqid('vid_') . '_' . basename($file['name']);
            $targetPath = UPLOAD_DIR . $fileName;
            if (move_uploaded_file($file['tmp_name'], $targetPath)) {
                $videoUrl = '/' . $targetPath; // URL accesible públicamente
            } else {
                // Si la subida falla, usamos el placeholder pero registramos
                error_log("Failed to move uploaded file: " . $file['tmp_name']);
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

        if (!$userId || !$videoId) respond(false, null, 'User ID and Video ID required.');

        $stmt = $pdo->prepare("SELECT watchLater FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $list = json_decode($stmt->fetchColumn(), true) ?? [];
        
        $key = array_search($videoId, $list);
        if ($key !== false) {
            unset($list[$key]); // Eliminar
        } else {
            $list[] = $videoId; // Agregar
        }
        
        $newList = array_values($list); // Reindexar
        
        $pdo->prepare("UPDATE users SET watchLater = ? WHERE id = ?")
            ->execute([json_encode($newList), $userId]);
        
        respond(true, ['list' => $newList]);
        break;
        
    case 'get_comments':
        $videoId = $_GET['videoId'] ?? null;
        if (!$videoId) respond(false, null, 'Video ID required.');
        
        $stmt = $pdo->prepare("SELECT c.id, c.videoId, c.userId, u.username, c.text, c.timestamp FROM comments c JOIN users u ON c.userId = u.id WHERE c.videoId = ? ORDER BY c.timestamp DESC");
        $stmt->execute([$videoId]);
        respond(true, $stmt->fetchAll(PDO::FETCH_ASSOC));
        break;

    case 'add_comment':
        $userId = $input['userId'] ?? null;
        $videoId = $input['videoId'] ?? null;
        $text = $input['text'] ?? null;
        
        if (!$userId || !$videoId || !$text) respond(false, null, 'Missing comment data.');

        $commentId = 'c_' . uniqid();
        $timestamp = time() * 1000;
        
        $pdo->prepare("INSERT INTO comments (id, videoId, userId, text, timestamp) VALUES (?, ?, ?, ?, ?)")
            ->execute([$commentId, $videoId, $userId, $text, $timestamp]);

        // Retornar el objeto de comentario completo para db.ts
        $user = get_user_by_id($pdo, $userId);
        respond(true, ['id' => $commentId, 'videoId' => $videoId, 'userId' => $userId, 'username' => $user['username'], 'text' => $text, 'timestamp' => $timestamp]);
        break;
        
    case 'admin_add_balance':
        $adminId = $input['adminId'] ?? null;
        $targetUserId = $input['targetUserId'] ?? null;
        $amount = (float)($input['amount'] ?? 0);

        // 1. Verificar permisos (rol ADMIN)
        $admin = get_user_by_id($pdo, $adminId);
        if (!$admin || $admin['role'] !== 'ADMIN') respond(false, null, 'Unauthorized or not an admin.');
        if ($amount <= 0) respond(false, null, 'Amount must be positive.');

        // 2. Actualizar el saldo
        $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")
            ->execute([$amount, $targetUserId]);
        
        respond(true, ['message' => 'Balance updated.']);
        break;
        
    // AÑADIR OTROS CASOS...
    // * get_related_videos (ej. por tags o creador, o simplemente aleatorio)
    // * get_interaction (SELECT liked, disliked, isWatched FROM user_interactions)
    // * toggle_like
    // * mark_watched
    // * update_user
    // * update_prices_bulk
    // * get_all_users
    // * get_transactions
    // * get_creator_videos

    default:
        respond(false, null, 'Invalid or unsupported action.');
}

?>
