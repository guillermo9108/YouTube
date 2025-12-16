
# Historial de Actualizaciones Técnicas - StreamPay

## v1.6.0 - Consolidación de Módulos Administrativos y Core Streaming

Esta versión estabiliza el núcleo de reproducción para servidores locales e integra lógica de negocio avanzada en todos los paneles de administración.

### 🚀 Core: Motor de Streaming y Procesamiento

#### 1. Proxy de Streaming PHP (Backend)
*   **Objetivo:** Permitir reproducción de archivos locales (`/volume1/...`, `C:\...`) que los navegadores bloquean por seguridad, y soportar formatos no nativos (MKV/AVI).
*   **Implementación Técnica:**
    *   **Byte-Range Requests:** Soporte completo para cabeceras HTTP `Range`. El servidor abre el archivo en modo binario (`rb`), salta al byte solicitado con `fseek` y sirve solo el fragmento necesario (Chunk de 256KB).
    *   **Limpieza de Buffer:** Implementación crítica de `ob_end_clean()` para eliminar cualquier "basura" (warnings, espacios) antes de enviar los headers de video, evitando errores de corrupción.
    *   **MIME Spoofing:** Se fuerza `Content-Type: video/mp4` para contenedores `.mkv`, `.avi` y `.mov`, engañando al navegador para que decodifique el stream H.264/H.265 interno.
    *   **Cache Busting:** Se añade `&t=timestamp` a las URLs de stream para evitar que el navegador cachee errores 404/500 previos.

#### 2. Generación de Metadatos Client-Side (Frontend)
*   **Objetivo:** Eliminar la carga de CPU del servidor (evitando FFmpeg) delegando el procesamiento al navegador del administrador.
*   **Implementación Técnica:**
    *   **Canvas Capture:** Se carga el video en un elemento HTMLVideoElement en memoria, se busca el segundo 1.5, y se dibuja en un Canvas 2D.
    *   **Blob Conversion:** El canvas se convierte a Blob JPEG y se sube al servidor mediante `XMLHttpRequest` o `fetch`.
    *   **Cola Secuencial:** El `GridProcessor` y `AdminLibrary` manejan una cola para procesar un video a la vez y no saturar la red.

---

### 🎛️ Detalle de Implementaciones por Módulo (Admin)

#### 1. Biblioteca (AdminLibrary)
*   **Paso 1 (Indexado):**
    *   Uso de `RecursiveDirectoryIterator` en PHP para escanear estructuras de carpetas profundas (NAS).
    *   Filtrado de archivos de sistema (ej. `@eaDir` en Synology) y validación de codificación UTF-8 en rutas.
*   **Paso 2 (Extracción):**
    *   Interfaz de reproducción automática oculta que recorre la lista de videos pendientes ("PENDING").
    *   Detección automática de rutas locales para enrutarlas por el Proxy de Streaming.
*   **Paso 3 (Organización Inteligente):**
    *   **Regex Parser:** Limpieza de nombres de archivo (eliminación de tags como `1080p`, `x264`, `www.`).
    *   **Folder Mapping:** Detección de estructura de carpetas para categorizar automáticamente (ej. carpeta "Peliculas" -> Categoría MOVIES).
*   **Paso 5 (AI Organization):**
    *   Integración con **Google Gemini 1.5 Flash**. Se envían lotes de títulos JSON y la IA devuelve la categorización semántica óptima.

#### 2. Finanzas (AdminFinance)
*   **Sistema de Aprobación ACID:**
    *   Transacciones atómicas para aprobar solicitudes de saldo/VIP. Si falla el registro en el historial, no se acredita el saldo.
    *   Registro dual: Actualización de la tabla `users` (balance/vipExpiry) e inserción en `transactions` (historial inmutable).
*   **Simulador de Proyecciones:**
    *   Algoritmo en Frontend que proyecta ingresos a 12 meses.
    *   Variables ajustables: Crecimiento de usuarios, Tasa de conversión, Ventas del Admin vs Comisiones P2P.
    *   Visualización mediante gráficos SVG generados dinámicamente.

#### 3. Configuración (AdminConfig)
*   **Gestión de Planes VIP:**
    *   Editor visual de objetos JSON almacenados en `system_settings`.
    *   Soporte para dos tipos de planes: `ACCESS` (Días ilimitados) y `BALANCE` (Recarga de saldo con % de bono).
*   **Integración de Pagos:**
    *   Configuración de credenciales API (Client ID/Secret) para **Tropipay**.
    *   Generación de referencias de pago únicas (`VP-UserId-PlanId-Time`) para conciliación automática via Webhook o retorno.

#### 4. Mantenimiento (AdminMaintenance)
*   **Limpieza de Huérfanos:**
    *   Script que lista todos los archivos físicos en `uploads/` y los compara contra los registros en la base de datos.
    *   Eliminación física (`unlink`) de archivos sin referencia SQL para recuperar espacio.
*   **Smart Cleaner:**
    *   Consulta SQL ponderada: `(views + (likes * 5) - (dislikes * 10))`.
    *   Identifica contenido de bajo rendimiento antiguo para sugerir su eliminación.

#### 5. FTP Remoto (AdminFtp)
*   **Conector Pasivo:** Cliente FTP PHP configurado en modo pasivo (`ftp_pasv`) para atravesar NATs y Firewalls.
*   **Indexación Remota:** Permite agregar videos a la base de datos guardando la ruta remota (`ftp://...`) en lugar de descargar el archivo. El sistema luego hace streaming "on-the-fly" desde el FTP origen al usuario final.

---

## Versiones Anteriores

### v1.5.0 - Estructura Base PWA
*   Arquitectura React + Vite + TypeScript.
*   Sistema de Base de Datos MariaDB.
*   Módulo de E-commerce (Marketplace) integrado.
*   API RESTful en PHP nativo.
