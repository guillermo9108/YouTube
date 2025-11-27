<?php
// install.php - Script de instalación para StreamPay

// Habilitar reporte de errores para depuración
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);
$configFile = 'db_config.json';

function respond($success, $data = null, $error = null) {
    header('Content-Type: application/json');
    echo json_encode(['success' => $success, 'data' => $data, 'error' => $error]);
    exit();
}

// Acción de prueba simple para verificar que el script responde
if ($action === 'ping') {
    respond(true, ['message' => 'pong']);
}

if ($action === 'check') {
    if (file_exists($configFile)) {
        $config = json_decode(file_get_contents($configFile), true);
        try {
            $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['name']}";
            $pdo = new PDO($dsn, $config['user'], $config['password']);
            $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
            if ($stmt->rowCount() > 0) {
                respond(true, ['installed' => true]);
            }
        } catch (Exception $e) { }
    }
    respond(true, ['installed' => false]);
}

if ($action === 'verify_db') {
    $host = $input['host'] ?? 'localhost';
    $port = $input['port'] ?? '3306';
    $user = $input['username'] ?? 'root';
    $pass = $input['password'] ?? '';
    try {
        $pdo = new PDO("mysql:host=$host;port=$port", $user, $pass);
        respond(true, ['message' => 'Connection successful']);
    } catch (PDOException $e) {
        respond(false, null, 'Connection failed: ' . $e->getMessage());
    }
}

if ($action === 'install') {
    $dbConfig = $input['dbConfig'];
    $adminUser = $input['adminUser'];

    $host = $dbConfig['host'];
    $port = $dbConfig['port'];
    $user = $dbConfig['username'];
    $pass = $dbConfig['password'];
    $dbname = $dbConfig['database'];

    try {
        $pdo = new PDO("mysql:host=$host;port=$port", $user, $pass);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `$dbname`");

        $pdo->exec("CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(50) PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('USER', 'ADMIN') DEFAULT 'USER',
            balance DECIMAL(10, 2) DEFAULT 0.00,
            autoPurchaseLimit DECIMAL(10, 2) DEFAULT 1.00,
            watchLater JSON
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS videos (
            id VARCHAR(50) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            price DECIMAL(10, 2) DEFAULT 0.00,
            thumbnailUrl VARCHAR(255),
            videoUrl VARCHAR(255),
            creatorId VARCHAR(50),
            views INT DEFAULT 0,
            createdAt BIGINT,
            likes INT DEFAULT 0,
            dislikes INT DEFAULT 0
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS transactions (
            id VARCHAR(50) PRIMARY KEY,
            buyerId VARCHAR(50),
            creatorId VARCHAR(50),
            videoId VARCHAR(50),
            amount DECIMAL(10, 2),
            timestamp BIGINT,
            type VARCHAR(20)
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS comments (
            id VARCHAR(50) PRIMARY KEY,
            videoId VARCHAR(50),
            userId VARCHAR(50),
            text TEXT,
            timestamp BIGINT
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS interactions (
            userId VARCHAR(50),
            videoId VARCHAR(50),
            liked TINYINT(1) DEFAULT 0,
            disliked TINYINT(1) DEFAULT 0,
            isWatched TINYINT(1) DEFAULT 0,
            PRIMARY KEY (userId, videoId)
        )");

        $adminId = 'u_' . uniqid();
        $hash = password_hash($adminUser['password'], PASSWORD_DEFAULT);
        
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE username = ?");
        $stmt->execute([$adminUser['username']]);
        if ($stmt->fetchColumn() == 0) {
            $stmt = $pdo->prepare("INSERT INTO users (id, username, password_hash, role, balance, autoPurchaseLimit, watchLater) VALUES (?, ?, ?, 'ADMIN', 999999.00, 100.00, '[]')");
            $stmt->execute([$adminId, $adminUser['username'], $hash]);
        }

        $configData = [
            'host' => $host,
            'port' => $port,
            'user' => $user,
            'password' => $pass,
            'name' => $dbname
        ];
        file_put_contents($configFile, json_encode($configData));

        if (!file_exists('../uploads/videos')) {
            mkdir('../uploads/videos', 0777, true);
        }

        respond(true, ['message' => 'Installation successful']);

    } catch (PDOException $e) {
        respond(false, null, 'Installation error: ' . $e->getMessage());
    }
}
?>