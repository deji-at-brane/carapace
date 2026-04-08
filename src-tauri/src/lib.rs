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
    _device_id: String,
    _device_name: String,
    state: tauri::State<'_, HandshakeState>,
) -> Result<HandshakeChallenge, String> {
    println!("[NATIVE] Resolving secure route (Rustls) for: {}", gateway_url);

    // 1. Normalize Host
    let raw_host = if gateway_url.contains("://") {
        gateway_url.split("://").nth(1).unwrap_or("").split('?').next().unwrap_or("")
    } else {
        gateway_url.split('?').next().unwrap_or("")
    };
    
    let is_ip = raw_host.split(':').next().unwrap_or("").chars().all(|c| c.is_numeric() || c == '.');
    let has_port = raw_host.contains(':');
    
    let mut current_url = if gateway_url.contains("://") {
        gateway_url.replace("agent://", "wss://").replace("claw://", "ws://")
    } else if is_ip {
        if has_port { format!("ws://{}/", gateway_url) } else { format!("ws://{}:18789/", gateway_url) }
    } else {
        format!("wss://{}/", gateway_url)
    };

    if !current_url.contains("://") {
        current_url = format!("ws://{}", current_url);
    }

    println!("[NATIVE] PROBING (Rustls): {}", current_url);
    
    // Explicit Subprotocol Request
    let request = http::Request::builder()
        .uri(&current_url)
        .header("Sec-WebSocket-Protocol", "mcp")
        .header("User-Agent", "Carapace-App/1.0")
        .body(())
        .map_err(|e| format!("Request buildup failed: {}", e))?;

    match connect_async(request).await {
        Ok((mut socket, response)) => {
            let protocol = response.headers()
                .get("Sec-WebSocket-Protocol")
                .and_then(|h| h.to_str().ok())
                .unwrap_or("none");
            
            println!("[NATIVE SUCCESS] Connected to {}. Subprotocol: {}. Waiting for challenge...", current_url, protocol);
            
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
                    return Ok(challenge);
                },
                _ => {
                    return Err(format!("PROTOCOL_ERROR: Gateway at {} did not initiate with a connect.challenge. Ensure this is an OpenClaw Agent.", current_url));
                }
            }
        },
        Err(e) => {
            let user_err = match e {
                tokio_tungstenite::tungstenite::Error::Tls(_) => format!("TLS_ERROR: SSL/TLS Handshake failed. Ensure the gateway has a valid certificate or try ws:// for development."),
                tokio_tungstenite::tungstenite::Error::Io(io_e) if io_e.kind() == std::io::ErrorKind::ConnectionRefused => format!("NETWORK_ERROR: Connection refused (Port 18789 blocked/inactive)."),
                tokio_tungstenite::tungstenite::Error::Io(io_e) if io_e.kind() == std::io::ErrorKind::TimedOut => format!("NETWORK_ERROR: Connection timed out. Gateway might be behind a strict firewall."),
                _ => format!("HANDSHAKE_ERROR: {}", e)
            };
            return Err(user_err);
        }
    }
}

#[tauri::command]
async fn mcp_finish_pairing(
    device_identity: serde_json::Value,
    client_identity: serde_json::Value,
    bootstrap_token: String,
    state: tauri::State<'_, HandshakeState>,
) -> Result<String, String> {
    println!("[NATIVE] Completing Handshake with verified Bootstrap Token...");
    
    let mut lock = state.socket.lock().await;
    let mut socket = lock.take().ok_or("SESSION_EXPIRED: No active handshake session found in vault.")?;

    let connect_frame = serde_json::json!({
        "type": "req",
        "method": "connect",
        "id": "pairing-final",
        "params": {
            "minProtocol": 3,
            "maxProtocol": 3,
            "client": client_identity,
            "auth": { "bootstrapToken": bootstrap_token },
            "device": device_identity
        }
    });

    socket.send(Message::Text(connect_frame.to_string()))
        .await
        .map_err(|e: tokio_tungstenite::tungstenite::Error| format!("TX_ERROR: Failed to transmit identity proof: {}", e))?;

    match tokio::time::timeout(std::time::Duration::from_secs(30), async {
        while let Some(Ok(msg)) = socket.next().await {
            if let Message::Text(text) = msg {
                let data: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
                
                if data["id"] == "pairing-final" {
                    if data["ok"] == true {
                        println!("[NATIVE] Connected successfully!");
                        return Ok(text);
                    } else {
                        let err_msg = data["error"]["message"].as_str().unwrap_or("Pairing failed");
                        
                        // Gateway explicitly requesting pairing flow
                        if err_msg.contains("pairing required") {
                            if let Some(request_id) = data["error"]["details"]["requestId"].as_str() {
                                println!("[NATIVE] Gateway expects manual approval. Providing requestId: {}", request_id);
                                let fake_success = serde_json::json!({
                                    "ok": true,
                                    "statusUrl": "manual_approval",
                                    "requestId": request_id
                                });
                                return Ok(fake_success.to_string());
                            }
                        }

                        // Return the full payload to the frontend so we can inspect it
                        return Err(format!("AUTH_REJECTED: {}", text));
                    }
                }
            }
        }
        Err("RX_ERROR: Gateway closed connection prematurely.".to_string())
    }).await {
        Ok(res) => res,
        Err(_) => Err("TIMEOUT: Gateway did not bond the session within 30 seconds.".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 🚩 SANDBOX ACTIVATION
    if std::env::var("CARAPACE_SANDBOX").is_ok() {
        println!("[BOOT] 🧪 SANDBOX MODE ACTIVE. Spawning mock agent at 127.0.0.1:18789...");
        tauri::async_runtime::spawn(async move {
            let _ = sandbox::spawn_sandbox(18789).await;
        });
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(HandshakeState {
            socket: Arc::new(Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            mcp_start_pairing,
            mcp_finish_pairing
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
