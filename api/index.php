<?php ob_start();
/**
 * StreamPay - Core Controller V13.4 (Full Integration)
 */
ini_set('display_errors', 0); 
error_reporting(E_ALL);
date_default_timezone_set('UTC');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Range');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    if (ob_get_level()) ob_clean();
    http_response_code(200);
    exit();
}

// Carga de módulos de funciones
require_once 'functions_utils.php';
require_once 'functions_auth.php';
require_once 'functions_videos.php';
require_once 'functions_interactions.php';
require_once 'functions_market.php';
require_once 'functions_admin.php';
require_once 'functions_portability.php';
require_once 'functions_ftp.php';
require_once 'functions_payment.php';

$configFile = 'db_config.json';
if (!file_exists($configFile)) respond(false, null, "Sistema no instalado");
$config = json_decode(file_get_contents($configFile), true);

try {
    $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['name']};charset=utf8mb4";
    $pdo = new PDO($dsn, $config['user'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) { respond(false, null, "Error BD: " . $e->getMessage()); }

function respond($success, $data = null, $error = null) {
    while (ob_get_level()) ob_end_clean(); 
    header('Content-Type: application/json');
    echo json_encode(['success' => $success, 'data' => $data, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit();
}

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

try {
    switch ($action) {
        // --- AUTH ---
        case 'login': auth_login($pdo, $input); break;
        case 'register': auth_register($pdo, $input); break;
        case 'heartbeat': auth_heartbeat($pdo, $input); break;
        case 'logout': auth_logout($pdo, $input); break;
        case 'get_user': auth_get_user($pdo, $_GET['userId'] ?? ''); break;
        case 'get_all_users': auth_get_all_users($pdo); break;
        case 'search_users': auth_search_users($pdo, $input); break;
        case 'update_user_profile': auth_update_user($pdo, $input); break;
        
        // --- VIDEOS & STREAMING ---
        case 'get_videos': video_get_all($pdo); break;
        case 'get_video': video_get_one($pdo, $_GET['id'] ?? ''); break;
        case 'get_videos_by_creator': video_get_by_creator($pdo, $_GET['userId'] ?? ''); break;
        case 'get_related_videos': video_get_related($pdo, $_GET['videoId'] ?? ''); break;
        case 'upload_video': video_upload($pdo, $_POST, $_FILES); break;
        case 'update_video_metadata': video_update_metadata($pdo, $_POST, $_FILES); break;
        case 'delete_video': video_delete($pdo, $input); break;
        case 'stream': streamVideo($_GET['id'] ?? '', $pdo); break;
        case 'update_video_details': 
            $pdo->prepare("UPDATE videos SET title = ?, price = ? WHERE id = ?")->execute([$input['title'], floatval($input['price']), $input['id']]);
            respond(true); break;

        // --- MARKETPLACE ---
        case 'get_marketplace_items': market_get_items($pdo); break;
        case 'admin_get_marketplace_items': market_admin_get_items($pdo); break;
        case 'get_marketplace_item': market_get_item($pdo, $_GET['id'] ?? ''); break;
        case 'create_listing': market_create_listing($pdo, $_POST, $_FILES); break;
        case 'edit_listing': market_edit_listing($pdo, $input); break;
        case 'admin_delete_listing': market_admin_delete_listing($pdo, $input); break;
        case 'get_reviews': market_get_reviews($pdo, $_GET['itemId'] ?? ''); break;
        case 'add_review': market_add_review($pdo, $input); break;
        case 'checkout_cart': market_checkout($pdo, $input); break;

        // --- INTERACTIONS & SOCIAL ---
        case 'rate_video': interact_rate($pdo, $input); break;
        case 'add_comment': interact_add_comment($pdo, $input); break;
        case 'get_comments': interact_get_comments($pdo, $_GET['id'] ?? ''); break;
        case 'purchase_video': interact_purchase($pdo, $input); break;
        case 'toggle_subscribe': interact_toggle_subscribe($pdo, $input); break;
        case 'get_notifications': interact_get_notifications($pdo, $_GET['userId'] ?? ''); break;
        case 'transfer_balance': interact_transfer_balance($pdo, $input); break;
        case 'share_video': interact_share_video($pdo, $input); break;
        case 'mark_notification_read': interact_mark_notification_read($pdo, $input); break;
        case 'mark_all_notifications_read': interact_mark_all_notifications_read($pdo, $input); break;
        case 'get_user_activity': interact_get_activity($pdo, $_GET['userId'] ?? ''); break;
        case 'has_purchased': interact_has_purchased($pdo, $_GET['userId'] ?? '', $_GET['videoId'] ?? ''); break;
        case 'check_subscription': interact_check_subscription($pdo, $_GET['userId'] ?? '', $_GET['creatorId'] ?? ''); break;
        case 'get_user_transactions': interact_get_transactions($pdo, $_GET['userId'] ?? ''); break;

        // --- REQUESTS BOX ---
        case 'get_requests': interact_get_all_requests($pdo); break;
        case 'request_content': interact_request_content($pdo, $input); break;
        case 'update_request_status': interact_update_request_status($pdo, $input); break;
        case 'delete_request': interact_delete_request($pdo, $input); break;

        // --- FINANCE & VIP ---
        case 'get_balance_requests': admin_get_finance_requests($pdo); break;
        case 'handle_balance_request': admin_handle_balance_request($pdo, $input); break;
        case 'handle_vip_request': admin_handle_vip_request($pdo, $input); break;
        case 'purchase_vip_instant': interact_purchase_vip_instant($pdo, $input); break;
        case 'submit_manual_vip_request': interact_submit_manual_vip_request($pdo, $_POST, $_FILES); break;
        case 'create_pay_link': interact_create_pay_link($pdo, $input); break;
        case 'verify_payment': payment_verify($pdo, $input); break;

        // --- ADMIN & MAINTENANCE ---
        case 'get_system_settings': admin_get_settings($pdo); break;
        case 'update_system_settings': admin_update_settings($pdo, $input); break;
        case 'get_real_stats': get_real_stats($pdo); break;
        case 'get_global_transactions': admin_get_global_transactions($pdo); break;
        case 'admin_add_balance': admin_add_balance($pdo, $input); break;
        case 'admin_repair_db': admin_repair_db($pdo); break;
        case 'admin_cleanup_files': admin_cleanup_files($pdo); break;
        case 'admin_smart_cleaner_preview': admin_smart_cleaner_preview($pdo, $input); break;
        case 'admin_smart_cleaner_execute': admin_smart_cleaner_execute($pdo, $input); break;
        case 'admin_get_logs': admin_get_logs(); break;
        case 'admin_clear_logs': admin_clear_logs(); break;
        case 'admin_get_local_stats': admin_get_local_stats($pdo); break;
        case 'admin_update_category_price': admin_update_category_price($pdo, $input); break;
        case 'admin_update_folder_price': admin_update_folder_price($pdo, $input); break;
        case 'admin_update_folder_sort': admin_update_folder_sort($pdo, $input); break;
        case 'client_log': @file_put_contents('client_errors.txt', "[".date('Y-m-d H:i:s')."] " . ($input['level'] ?? 'INFO') . ": " . ($input['message'] ?? '') . PHP_EOL, FILE_APPEND); respond(true); break;

        // --- LIBRARY ENGINE ---
        case 'get_admin_library_stats': video_get_admin_stats($pdo); break;
        case 'scan_local_library': video_scan_local($pdo, $input); break;
        case 'get_scan_folders': video_get_scan_folders($pdo); break;
        case 'smart_organize_library': video_smart_organize($pdo); break;
        case 'reorganize_all_videos': video_reorganize_all($pdo); break;
        case 'fix_library_metadata': video_fix_metadata($pdo); break;

        // --- TRANSCODER ---
        case 'admin_get_transcode_profiles': admin_get_transcode_profiles($pdo); break;
        case 'admin_save_transcode_profile': admin_save_transcode_profile($pdo, $input); break;
        case 'admin_delete_transcode_profile': admin_delete_transcode_profile($pdo, $_GET['extension'] ?? ''); break;
        case 'admin_transcode_scan_filters': admin_transcode_scan_filters($pdo, $input); break;
        case 'admin_process_next_transcode': admin_process_next_transcode($pdo); break;
        case 'admin_retry_failed_transcodes': admin_retry_failed_transcodes($pdo); break;
        case 'admin_clear_transcode_queue': admin_clear_transcode_queue($pdo); break;

        // --- PORTABILITY ---
        case 'port_save_backup': port_save_backup($pdo, $_POST, $_FILES); break;
        case 'port_restore_backup': port_restore_backup($pdo, $input); break;

        // --- FTP ---
        case 'list_ftp_files': listFtpFiles($pdo, $_GET['path'] ?? '/'); break;
        case 'import_ftp_file': importFtpFile($pdo, $input); break;
        case 'scan_ftp_recursive': scanFtpRecursive($pdo, $input); break;

        // --- SEARCH ---
        case 'save_search': interact_save_search($pdo, $input); break;
        case 'get_search_suggestions': interact_get_search_suggestions($pdo, $_GET['q'] ?? ''); break;

        default: respond(false, null, "Acción desconocida: $action"); break;
    }
} catch (Exception $e) { respond(false, null, $e->getMessage()); }
?>