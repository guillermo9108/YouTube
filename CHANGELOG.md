
# Historial de Actualizaciones - StreamPay

## Versión 1.4 (Actual) - Optimización de Rendimiento y NAS

Esta versión se centra en la capacidad de ejecutar la plataforma en hardware modesto (NAS, Raspberry Pi, Hosting Compartido) moviendo la carga de procesamiento pesado del servidor al cliente y mejorando la lógica de archivos.

### 🎥 Reproducción de Video Local
*   **Método:** Proxy de Streaming PHP con soporte de Rangos de Bytes (Byte-Range Requests).
*   **Ubicación:** Función `streamVideo` en `api/functions_utils.php`.
*   **Detalles Técnicos:**
    *   En lugar de servir el archivo estático (que a menudo falla por restricciones de seguridad del navegador con rutas locales o permisos de NAS) o cargar el archivo completo en memoria RAM, el script actúa como un servidor de streaming inteligente.
    *   El backend intercepta las cabeceras HTTP `Range` enviadas por el navegador (ej. `bytes=0-102400`).
    *   Abre el archivo local en modo binario (`rb`) y busca (`fseek`) la posición exacta solicitada.
    *   Envía el fragmento de datos (Chunk) con el código de estado `206 Partial Content`.
    *   **Resultado:** Permite reproducción instantánea, "seeking" (saltar a cualquier punto) fluido y soporte para archivos masivos (4K/MKV) consumiendo apenas unos KB de RAM en el servidor.

### 🖼️ Extracción de Miniaturas y Duración
*   **Método:** Procesamiento en el Cliente (Client-Side Canvas & HTML5 Video API).
*   **Ubicación:** Componentes `GridProcessor.tsx` (para escaneo local) y `utils/videoGenerator.ts` (para subidas).
*   **Detalles Técnicos:**
    *   **Anteriormente:** Se dependía de FFmpeg en el servidor, lo cual era lento y colapsaba la CPU en servidores modestos.
    *   **Actualmente:**
        1.  El navegador carga el video (o el stream local) en un elemento `<video>` oculto en memoria.
        2.  **Duración:** Se lee la propiedad nativa `video.duration` del elemento HTML5 una vez cargados los metadatos.
        3.  **Miniatura:** Se fuerza al video a buscar (`seek`) el segundo `1.5` (para evitar pantallas negras iniciales). Se usa un elemento `<canvas>` HTML5 para "dibujar" el fotograma actual del video (`ctx.drawImage`).
        4.  El canvas se convierte en un archivo binario JPG (`canvas.toBlob`) y se envía al servidor para guardarlo.
    *   **Resultado:** Cero carga de CPU para el servidor en tareas de transcodificación.

### 📂 Organización Inteligente (Smart Organizer v2)
*   **Método:** Análisis Jerárquico de Rutas con Bloqueo de Categoría.
*   **Ubicación:** Función `smartParseFilename` en `api/functions_utils.php`.
*   **Lógica de Prioridad:**
    1.  **Análisis de Ancestros (Prioridad Máxima):** Escanea las carpetas Padre, Abuela y Bisabuela. Si encuentra coincidencia con una Categoría Personalizada o Estándar (ej. "Action Movies"), asigna esa categoría y activa un **Bloqueo (Lock)**.
    2.  **Detección de Episodios:** Si no hay bloqueo, busca patrones de series (`S01E01`, `1x01`) en el nombre del archivo para asignar "SERIES".
    3.  **Fallback por Duración:** Si no hay coincidencias de texto ni carpetas, clasifica basándose en la duración del video (Shorts < 3min, Películas > 45min).

---

## Versión 1.3 - E-commerce y VIP

### 🛒 Marketplace P2P
*   Sistema completo de compra/venta de productos físicos entre usuarios.
*   Gestión de stock, estados de pedido (Pendiente/Enviado) y reseñas.
*   Integración del saldo virtual para pagos de productos.

### 👑 Sistema VIP
*   Implementación de membresías temporales (Días de acceso ilimitado).
*   Implementación de paquetes de recarga con bonificación.
*   Integración con pasarela de pago Tropipay.

---

## Versión 1.2 - Core y Economía

### 💰 Sistema de Economía Cerrada (Saldo)
*   Billetera virtual interna.
*   Historial de transacciones inmutable.
*   Sistema de comisiones configurables para el administrador (Revenue Share).

### ☁️ Gestor de Archivos FTP
*   Capacidad de conectarse a servidores FTP remotos.
*   Indexación de archivos remotos sin descarga (Streaming directo desde FTP).
