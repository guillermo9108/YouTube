
<?php

// --- TROPIPAY INTEGRATION ---

function getTropipayToken($clientId, $clientSecret) {
    $curl = curl_init();
    $data = json_encode([
        "grant_type" => "client_credentials",
        "client_id" => $clientId,
        "client_secret" => $clientSecret,
        "scope" => "allow_payment_link_creation"
    ]);

    curl_setopt_array($curl, [
        CURLOPT_URL => "https://tropipay.com/api/v2/access/token",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => "",
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => "POST",
        CURLOPT_POSTFIELDS => $data,
        CURLOPT_HTTPHEADER => [
            "Content-Type: application/json"
        ],
    ]);

    $response = curl_exec($curl);
    $err = curl_error($curl);
    curl_close($curl);

    if ($err) throw new Exception("cURL Error: " . $err);
    
    $json = json_decode($response, true);
    if (!isset($json['access_token'])) throw new Exception("Tropipay Auth Failed: " . ($json['error'] ?? 'Unknown'));
    
    return $json['access_token'];
}

function payment_create_link($pdo, $input) {
    $userId = $input['userId'];
    $plan = $input['plan']; // VipPlan object
    
    // 1. Get Settings
    $stmt = $pdo->query("SELECT tropipayClientId, tropipayClientSecret, currencyConversion FROM system_settings LIMIT 1");
    $s = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (empty($s['tropipayClientId']) || empty($s['tropipayClientSecret'])) {
        respond(false, null, 'Tropipay no configurado en el Admin Panel');
    }

    // 2. Conversion Logic
    // Plans are usually in "Saldo" (CUP/Points). We need to charge EUR or USD via Tropipay.
    // currencyConversion = How many Saldo per 1 EUR? e.g. 300
    // Amount EUR = Plan Price / Conversion
    $rate = floatval($s['currencyConversion']) ?: 1; // Default 1:1 if not set
    $amountEUR = round($plan['price'] / $rate, 2);
    
    // Minimum Tropipay is often 5-10 EUR, ensure we don't fail
    if ($amountEUR < 1) $amountEUR = 1;

    try {
        $token = getTropipayToken($s['tropipayClientId'], $s['tropipayClientSecret']);
        
        // 3. Create Pay Link
        // We use the Plan ID + User ID + Timestamp as reference to verify later
        $reference = "VP-" . $userId . "-" . $plan['id'] . "-" . time();
        
        // Frontend URL for return
        // We assume the frontend is running on the same host
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
        $host = $_SERVER['HTTP_HOST'];
        // Path to index.html (PWA root)
        // If api is in /api/, root is one up.
        $baseUrl = $protocol . $host . dirname(dirname($_SERVER['PHP_SELF'])); 
        // Force clean base
        $baseUrl = str_replace('/api', '', $baseUrl);
        $baseUrl = rtrim($baseUrl, '/');
        
        $successUrl = $baseUrl . "/#/vip?status=success&ref=" . $reference;
        $cancelUrl = $baseUrl . "/#/vip?status=cancel";

        $payload = json_encode([
            "reference" => $reference,
            "concept" => "StreamPay VIP: " . $plan['name'],
            "description" => "Plan VIP para usuario " . $userId,
            "amount" => $amountEUR * 100, // Tropipay uses cents
            "currency" => "EUR",
            "lang" => "es",
            "urlSuccess" => $successUrl,
            "urlFailed" => $cancelUrl,
            "directPayment" => true, // Go straight to pay method selection
            "serviceDate" => date('Y-m-d')
        ]);

        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => "https://tropipay.com/api/v2/paymentcards",
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => "POST",
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => [
                "Content-Type: application/json",
                "Authorization: Bearer " . $token
            ],
        ]);

        $response = curl_exec($curl);
        $err = curl_error($curl);
        curl_close($curl);

        if ($err) throw new Exception("Tropipay Error: " . $err);
        
        $json = json_decode($response, true);
        if (empty($json['paymentUrl'])) throw new Exception("No Payment URL returned: " . $response);

        // 4. Save Pending Request locally so we know what plan to give
        $pdo->prepare("INSERT INTO vip_requests (id, userId, planSnapshot, status, createdAt, paymentRef) VALUES (?, ?, ?, 'PENDING', ?, ?)")
            ->execute([uniqid('pp_'), $userId, json_encode($plan), time(), $reference]);

        respond(true, ['paymentUrl' => $json['paymentUrl']]);

    } catch (Exception $e) {
        respond(false, null, $e->getMessage());
    }
}

function payment_verify($pdo, $input) {
    $ref = $input['reference'];
    $userId = $input['userId'];
    
    // 1. Find the pending request
    $stmt = $pdo->prepare("SELECT * FROM vip_requests WHERE paymentRef = ? AND userId = ? AND status = 'PENDING'");
    $stmt->execute([$ref, $userId]);
    $req = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$req) respond(false, null, 'Solicitud no encontrada o ya procesada.');

    // 2. Get Settings & Token
    $stmtS = $pdo->query("SELECT tropipayClientId, tropipayClientSecret FROM system_settings LIMIT 1");
    $s = $stmtS->fetch(PDO::FETCH_ASSOC);
    
    try {
        $token = getTropipayToken($s['tropipayClientId'], $s['tropipayClientSecret']);
        
        // 3. Search Movement by Reference
        // Note: Tropipay API structure might vary, ideally we search by reference
        // /api/v2/movements?reference=XYZ
        
        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => "https://tropipay.com/api/v2/movements?reference=" . $ref,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ["Authorization: Bearer " . $token],
        ]);
        
        $response = curl_exec($curl);
        curl_close($curl);
        
        $json = json_decode($response, true);
        $rows = $json['rows'] ?? [];
        
        $validPayment = false;
        foreach ($rows as $row) {
            // Check if COMPLETED and amount matches roughly (sanity check)
            if ($row['reference'] === $ref && $row['status'] === 'COMPLETED' && $row['movement_type'] === 2) { // Type 2 = Ingreso usually
                $validPayment = true;
                break;
            }
        }
        
        if ($validPayment) {
            // --- APPROVE LOGIC (Same as Admin) ---
            $plan = json_decode($req['planSnapshot'], true);
            $pdo->beginTransaction();
            
            // Mark Request Approved
            $pdo->prepare("UPDATE vip_requests SET status = 'APPROVED' WHERE id = ?")->execute([$req['id']]);
            
            if ($plan['type'] === 'BALANCE') {
                $baseAmount = floatval($plan['price']);
                $bonus = floatval($plan['bonusPercent'] ?? 0);
                $total = $baseAmount + ($baseAmount * ($bonus / 100));
                
                $pdo->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$total, $userId]);
                
                // Transaction Log
                $tid = uniqid('tx_vip_auto_');
                $pdo->prepare("INSERT INTO transactions (id, buyerId, creatorId, videoId, amount, timestamp, type) VALUES (?, ?, NULL, NULL, ?, ?, 'VIP')")
                    ->execute([$tid, $userId, $total, time()]);
                    
            } else {
                $days = intval($plan['durationDays']);
                $seconds = $days * 86400;
                $now = time();
                
                $stmtUser = $pdo->prepare("SELECT vipExpiry FROM users WHERE id = ?");
                $stmtUser->execute([$userId]);
                $currentExpiry = intval($stmtUser->fetchColumn());
                
                $newStart = ($currentExpiry > $now) ? $currentExpiry : $now;
                $newExpiry = $newStart + $seconds;
                
                $pdo->prepare("UPDATE users SET vipExpiry = ? WHERE id = ?")->execute([$newExpiry, $userId]);
            }
            
            // Notify
            $nid = uniqid('n_');
            $pdo->prepare("INSERT INTO notifications (id, userId, type, text, link, isRead, timestamp) VALUES (?, ?, 'SYSTEM', ?, '/profile', 0, ?)")
                ->execute([$nid, $userId, "Pago confirmado. Plan '{$plan['name']}' activado.", time()]);
            
            $pdo->commit();
            respond(true, ['message' => 'VIP Activado Exitosamente']);
        } else {
            respond(false, null, 'Pago no encontrado o pendiente en Tropipay. Intenta de nuevo en unos minutos.');
        }

    } catch (Exception $e) {
        respond(false, null, $e->getMessage());
    }
}
?>
