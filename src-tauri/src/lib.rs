use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use futures_util::{StreamExt, SinkExt};
use serde::{Deserialize, Serialize};

mod sandbox;

// Handshake State for persisting the socket between stages
pub struct HandshakeState {
    pub socket: Arc<Mutex<Option<tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>>>>,
}

#[derive(Serialize, Deserialize)]
pub struct HandshakeChallenge {
    pub nonce: String,
    pub ts: i64,
}

#[tauri::command]
async fn mcp_start_pairing(
    gateway_url: String,
    _token: String,
    device_id: String,
    _device_name: String,
    state: tauri::State<'_, HandshakeState>,
) -> Result<HandshakeChallenge, String> {
    println!("[NATIVE] Resolving secure route (Rustls) for: {}", gateway_url);

    // Robust URL Normalization
    let mut parsed_url = if gateway_url.contains("://") {
        let normalized = gateway_url
            .replace("agent://", "wss://")
            .replace("claw://", "ws://");
        url::Url::parse(&normalized).map_err(|e| format!("URL_PARSE_ERROR: {}", e))?
    } else {
        let has_port = gateway_url.contains(':');
        let is_ip = gateway_url.split(':').next().unwrap_or("").chars().all(|c| c.is_numeric() || c == '.');
        let scheme = if is_ip { "ws" } else { "wss" };
        let port_suffix = if has_port { "" } else { ":18789" };
        
        url::Url::parse(&format!("{}://{}{}/", scheme, gateway_url, port_suffix))
            .map_err(|e| format!("URL_PARSE_ERROR: {}", e))?
    };

    if parsed_url.path().is_empty() {
        parsed_url.set_path("/");
    }

    let current_url = parsed_url.to_string();
    println!("[NATIVE] PROBING (Normalized): {}", current_url);
    
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;
    let mut request = current_url.clone().into_client_request()
        .map_err(|e| format!("Request buildup failed: {}", e))?;
    
    // Inject Custom Subprotocol and Identity Headers
    request.headers_mut().insert("Sec-WebSocket-Protocol", http::HeaderValue::from_static("mcp"));
    request.headers_mut().insert("User-Agent", http::HeaderValue::from_static("Carapace-App/1.0"));
    
    // ACTIVE INITIATION: Inject Device ID into Headers
    request.headers_mut().insert("Sec-Mcp-Device-Id", http::HeaderValue::from_str(&device_id).unwrap_or(http::HeaderValue::from_static("unknown")));

    match connect_async(request).await {
        Ok((mut socket, response)) => {
            let protocol = response.headers()
                .get("Sec-WebSocket-Protocol")
                .and_then(|h| h.to_str().ok())
                .unwrap_or("none");
            
            println!("[NATIVE SUCCESS] Connected to {}. Subprotocol: {}.", current_url, protocol);
            println!("[NATIVE] Session ID bind (Header): {}. Waiting for challenge...", device_id);

            match tokio::time::timeout(std::time::Duration::from_secs(45), async {
                while let Some(Ok(msg)) = socket.next().await {
                    if let Message::Text(text) = msg {
                        let data: serde_json::Value = serde_json::from_str(&text).ok()?;
                        if data["type"] == "event" && data["event"] == "connect.challenge" {
                            return Some(data);
                        }
                    }
                }
                None
            }).await {
                Ok(Some(data)) => {
                    let payload = &data["payload"];
                    let challenge = HandshakeChallenge {
                        nonce: payload["nonce"].as_str().unwrap_or_default().to_string(),
                        ts: payload["ts"].as_i64().unwrap_or_default(),
                    };
                    
                    let mut lock = state.socket.lock().await;
                    *lock = Some(socket);
                    Ok(challenge)
                },
                _ => {
                    Err(format!("PROTOCOL_ERROR: Gateway at {} did not initiate with a connect.challenge.", current_url))
                }
            }
        },
        Err(e) => Err(format!("WS_CONNECT_ERROR: {}", e)),
    }
}

#[tauri::command]
async fn mcp_finish_pairing(
    device_identity: serde_json::Value,
    client_identity: serde_json::Value,
    bootstrap_token: String,
    state: tauri::State<'_, HandshakeState>,
) -> Result<String, String> {
    let mut lock = state.socket.lock().await;
    let mut socket = lock.take().ok_or("No active connection. Start pairing first.")?;

    println!("[NATIVE] Completing Handshake with verified Bootstrap Token...");

    let client_id = client_identity["id"].as_str().unwrap_or("unknown");
    let version = client_identity["version"].as_str().unwrap_or("1.0.0");
    let mode = client_identity["mode"].as_str().unwrap_or("cli");
    let platform = client_identity["platform"].as_str().unwrap_or("macos");
    
    let device_json = serde_json::to_string(&device_identity).map_err(|e| e.to_string())?;

    // RAW PROTOCOL FRAME INJECTION (Strictly Minimalist to avoid schema rejection)
    let connect_frame = format!(
        r#"{{"type":"req","method":"connect","id":"pairing-final","params":{{"minProtocol":3,"maxProtocol":3,"client":{{"id":"{}","version":"{}","mode":"{}","platform":"{}","deviceFamily":"desktop"}},"auth":{{"bootstrapToken":"{}"}},"device":{}}}}}"#,
        client_id, version, mode, platform, bootstrap_token, device_json
    );
    
    println!("[DEBUG] Final Connect RAW: {}", connect_frame);
    socket.send(Message::Text(connect_frame)).await.map_err(|e| e.to_string())?;

    let mut result_json = String::new();
    if let Some(Ok(msg)) = socket.next().await {
        if let Message::Text(text) = msg {
            println!("[DEBUG] Gateway Response: {}", text);
            result_json = text;
        }
    }

    Ok(result_json)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
        .plugin(tauri_plugin_opener::init())
        .manage(HandshakeState { socket: Arc::new(Mutex::new(None)) })
        .invoke_handler(tauri::generate_handler![mcp_start_pairing, mcp_finish_pairing])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
