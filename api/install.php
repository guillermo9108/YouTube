<?php
// install.php

// Función de respuesta JSON uniforme
function respond($success, $data = null, $error = null) {
    header('Content-Type: application/json');
    echo json_encode(['success' => $success, 'data' => $data, 'error' => $error]);
    exit();
}

// Verifica la existencia y permisos de la carpeta de subidas
function check_upload_dir() {
    $upload_dir = 'uploads/videos';
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0777, true);
    }
}

// Intenta establecer una conexión con la configuración proporcionada
function test_db_connection($config) {
    try {
        $pdo = new PDO(
            "mysql:host={$config['host']};dbname={$config['name']}",
            $config['user'],
            $config['password'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        return $pdo;
    } catch (PDOException $e) {
        return false;
    }
}

// --- Lógica Principal ---
$action = $_GET['action'] ?? null;
check_upload_dir();

switch ($action) {
    case 'check':
        // 1. checkInstallation: Verifica si el sistema está instalado.
        // Podríamos comprobar si el archivo de configuración de DB existe o si una tabla clave existe.
        // Simplificaremos asumiendo que si existe el archivo config, está instalado.
        $installed = file_exists('db_config.json');
        respond(true, ['installed' => $installed]);
        break;

    case 'verify_db':
        // 2. verifyDbConnection: Verifica la conexión a la DB antes de instalar.
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data) respond(false, null, 'Invalid configuration data.');
        
        if (test_db_connection($data)) {
            respond(true, ['message' => 'Connection successful.']);
        } else {
            respond(false, null, 'Database connection failed. Check host, user, and password.');
        }
        break;

    case 'install':
        // 3. initializeSystem: Guarda la configuración de DB y crea las tablas.
        $payload = json_decode(file_get_contents('php://input'), true);
        $dbConfig = $payload['dbConfig'] ?? null;
        $adminUser = $payload['adminUser'] ?? null;

        if (!$dbConfig || !$adminUser) respond(false, null, 'Missing installation data.');

        $pdo = test_db_connection($dbConfig);
        if (!$pdo) respond(false, null, 'Database connection failed during install.');

        // Guardar la configuración de DB
        file_put_contents('db_config.json', json_encode($dbConfig));
        
        // Esquema de la Base de Datos (SQL)
        $sql = file_get_contents('schema.sql'); 
        
        // Aquí deberías tener un archivo 'schema.sql' con las sentencias CREATE TABLE.
        // Por la brevedad, puedes usar un script simple que crearemos a continuación
        // para las tablas 'users', 'videos', 'transactions', 'comments', 'user_interactions'.
        // Nota: Por simplicidad, ejecutaremos las sentencias manualmente.

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(50) PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash CHAR(60) NOT NULL, -- Usar un hash real, no almacenar en texto plano
                role VARCHAR(50) NOT NULL DEFAULT 'USER',
                balance DECIMAL(10, 2) DEFAULT 0.00,
                autoPurchaseLimit DECIMAL(10, 2) DEFAULT 0.00,
                watchLater TEXT
            );

            CREATE TABLE IF NOT EXISTS videos (
                id VARCHAR(50) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                thumbnailUrl VARCHAR(255),
                videoUrl VARCHAR(255) NOT NULL,
                creatorId VARCHAR(50) NOT NULL,
                views INT DEFAULT 0,
                createdAt BIGINT,
                likes INT DEFAULT 0,
                dislikes INT DEFAULT 0,
                FOREIGN KEY (creatorId) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id VARCHAR(50) PRIMARY KEY,
                buyerId VARCHAR(50) NOT NULL,
                creatorId VARCHAR(50) NOT NULL,
                videoId VARCHAR(50),
                amount DECIMAL(10, 2) NOT NULL,
                timestamp BIGINT,
                type VARCHAR(50),
                FOREIGN KEY (buyerId) REFERENCES users(id),
                FOREIGN KEY (creatorId) REFERENCES users(id)
            );

            -- Tabla de Interacciones (para likes/dislikes/visto)
            CREATE TABLE IF NOT EXISTS user_interactions (
                userId VARCHAR(50) NOT NULL,
                videoId VARCHAR(50) NOT NULL,
                liked BOOLEAN DEFAULT 0,
                disliked BOOLEAN DEFAULT 0,
                isWatched BOOLEAN DEFAULT 0,
                PRIMARY KEY (userId, videoId),
                FOREIGN KEY (userId) REFERENCES users(id),
                FOREIGN KEY (videoId) REFERENCES videos(id)
            );

            CREATE TABLE IF NOT EXISTS comments (
                id VARCHAR(50) PRIMARY KEY,
                videoId VARCHAR(50) NOT NULL,
                userId VARCHAR(50) NOT NULL,
                text TEXT NOT NULL,
                timestamp BIGINT,
                FOREIGN KEY (videoId) REFERENCES videos(id),
                FOREIGN KEY (userId) REFERENCES users(id)
            );
        ");

        // Crear usuario administrador inicial
        $adminId = $adminUser['id'] ?? 'admin_' . time();
        $username = $adminUser['username'] ?? 'admin';
        // En una aplicación real, NUNCA uses password_hash() sin password_verify().
        $passwordHash = password_hash($adminUser['password'] ?? 'password', PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (id, username, password_hash, role, balance, autoPurchaseLimit) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $adminId, 
            $username, 
            $passwordHash, 
            $adminUser['role'] ?? 'ADMIN', 
            $adminUser['balance'] ?? 1000.00, 
            $adminUser['autoPurchaseLimit'] ?? 5.00
        ]);

        respond(true, ['message' => 'System installed successfully.']);
        break;

    default:
        respond(false, null, 'Invalid action specified.');
}

// Incluye la lógica para el archivo db_config.php para futuras conexiones:
// Para la operación normal, el archivo db_config.json es cargado y usado por index.php.

?>
