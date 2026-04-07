use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use futures_util::{StreamExt, SinkExt};
use serde::{Deserialize, Serialize};

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
    url: String,
    _bootstrap_token: String,
    _device_id: String,
    _device_name: String,
    state: tauri::State<'_, HandshakeState>,
) -> Result<HandshakeChallenge, String> {
    println!("[NATIVE] Resolving secure route for: {}", url);

    // 1. Determine Initial Target
    let initial_url = if url.contains("://") { 
        url.replace("claw://", "ws://").replace("agent://", "ws://")
    } else { 
        format!("ws://{}/", url) 
    };

    // 2. Discover Best Possible Routes: Seed with high-probability Cloud candidates!
    let mut probe_urls = Vec::new();
    
    // a. Always try the user's provided URL first
    probe_urls.push(initial_url.clone());

    // b. Extract host for secure fallbacks
    let domain_part = if initial_url.contains("://") {
        initial_url.split("://").collect::<Vec<&str>>()[1]
    } else {
        &initial_url
    };
    let host_only = if domain_part.contains(']') && domain_part.contains("]:") {
         domain_part.split("]:").collect::<Vec<&str>>()[0].to_string() + "]"
    } else if domain_part.contains(':') && !domain_part.contains(']') {
         domain_part.split(':').collect::<Vec<&str>>()[0].to_string()
    } else {
         domain_part.trim_end_matches('/').to_string()
    };

    // c. Seed with common Cloud Gateway patterns (Port 443 / SSL)
    if !initial_url.contains(":443") {
        probe_urls.push(format!("wss://{}:443/", host_only));
        probe_urls.push(format!("wss://{}:443/vss/", host_only));
        probe_urls.push(format!("wss://{}:443/vss/ws/", host_only));
    }

    // 2. Proactively Follow Redirects (Check for even more hidden paths)
    let http_url = initial_url.replace("ws://", "http://").replace("wss://", "https://");
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .user_agent("Mozilla/5.0 CarapaceTerminal/1.0")
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    if let Ok(r) = client.get(&http_url).send().await {
        let terminal_url = r.url().to_string();
        if terminal_url != http_url {
            let base = terminal_url.replace("http://", "ws://").replace("https://", "wss://");
            if !probe_urls.contains(&base) {
                probe_urls.push(base.clone());
            }
        }
    }

    // 3. Setup Flexible TLS Connector
    let mut tls_builder = native_tls::TlsConnector::builder();
    tls_builder.danger_accept_invalid_hostnames(true);
    let native_tls_connector = tls_builder.build().map_err(|e| e.to_string())?;
    let stream_config = tokio_tungstenite::Connector::NativeTls(native_tls_connector);

    let mut final_error = String::from("No connection reachable");
    
    // 4. Connect with an aggressive 60-second multi-probe window
    for mut current_url in probe_urls {
        if current_url.contains(":443") {
            current_url = current_url.replace("ws://", "wss://");
        }

        println!("[NATIVE] PROBING: {}", current_url);
        
        let handshake_future = tokio_tungstenite::connect_async_tls_with_config(&current_url, None, false, Some(stream_config.clone()));
        match tokio::time::timeout(std::time::Duration::from_secs(15), handshake_future).await {
            Ok(Ok((mut socket, _))) => {
                println!("[NATIVE SUCCESS] Connected to {}. Waiting for challenge...", current_url);
                
                match tokio::time::timeout(std::time::Duration::from_secs(20), async {
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
                        println!("[NATIVE] {} quiet (no challenge). Trying next...", current_url);
                        continue;
                    }
                }
            },
            Ok(Err(e)) => {
                println!("[NATIVE] {} failed: {}", current_url, e);
                final_error = format!("{} failed early: {}", current_url, e);
            },
            Err(_) => {
                println!("[NATIVE] {} timed out. Trying next...", current_url);
                final_error = format!("{} timed out", current_url);
            }
        }
    }

    Err(format!("Pairing failed after deep discovery: {}", final_error))
}

#[tauri::command]
async fn mcp_finish_pairing(
    device_identity: serde_json::Value,
    bootstrap_token: String,
    state: tauri::State<'_, HandshakeState>,
) -> Result<String, String> {
    println!("[NATIVE] Completing Handshake with verified Bootstrap Token...");
    
    let mut lock = state.socket.lock().await;
    let mut socket = lock.take().ok_or("No active handshake session")?;

    // FINAL ALIGNED SCHEMA: auth.bootstrapToken (Verified via Fuzzer)
    let connect_frame = serde_json::json!({
        "type": "req",
        "method": "connect",
        "params": {
            "minProtocol": 3,
            "maxProtocol": 3,
            "client": { 
                "id": "openclaw-macos", 
                "version": "1.0.0", 
                "platform": "macos", 
                "mode": "cli",
                "deviceFamily": "desktop"
            },
            "auth": { "bootstrapToken": bootstrap_token },
            "device": device_identity
        },
        "id": "pairing-final"
    });

    socket.send(Message::Text(connect_frame.to_string())).await.map_err(|e| e.to_string())?;

    // Wait for result
    while let Some(Ok(msg)) = socket.next().await {
        if let Message::Text(text) = msg {
            let data: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
            
            if data["id"] == "pairing-final" {
                if data["ok"] == true {
                    println!("[NATIVE] Pairing SUCCESS!");
                    return Ok(text);
                } else {
                    let err = data["error"]["message"].as_str().unwrap_or("Pairing failed").to_string();
                    println!("[NATIVE] Pairing ERROR: {}", err);
                    return Err(err);
                }
            }
        }
    }

    Err("Handshake session closed before completion".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(HandshakeState { socket: Arc::new(Mutex::new(Option::None)) })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}))
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![mcp_start_pairing, mcp_finish_pairing])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
