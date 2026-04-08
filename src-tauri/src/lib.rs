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
    gatewayUrl: String,
    token: String,
    deviceId: String,
    deviceName: String,
    state: tauri::State<'_, HandshakeState>,
) -> Result<HandshakeChallenge, String> {
    println!("[NATIVE] Resolving secure route (Rustls) for: {}", gatewayUrl);

    // 1. Normalize Host
    let raw_host = if gatewayUrl.contains("://") {
        gatewayUrl.split("://").nth(1).unwrap_or("").split('?').next().unwrap_or("")
    } else {
        gatewayUrl.split('?').next().unwrap_or("")
    };
    
    let is_ip = raw_host.split(':').next().unwrap_or("").chars().all(|c| c.is_numeric() || c == '.');
    let has_port = raw_host.contains(':');
    
    let mut current_url = if gatewayUrl.contains("://") {
        gatewayUrl.replace("agent://", "wss://").replace("claw://", "ws://")
    } else if is_ip {
        if has_port { format!("ws://{}/", gatewayUrl) } else { format!("ws://{}:18789/", gatewayUrl) }
    } else {
        format!("wss://{}/", gatewayUrl)
    };

    if !current_url.contains("://") {
        current_url = format!("ws://{}", current_url);
    }

    println!("[NATIVE] PROBING (Rustls): {}", current_url);
    let mut final_error = String::from("No connection reachable");
    
    match connect_async(&current_url).await {
        Ok((mut socket, _)) => {
            println!("[NATIVE SUCCESS] Connected to {}. Waiting for challenge...", current_url);
            
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
                    final_error = format!("Gateway at {} did not respond with a handshake challenge.", current_url);
                }
            }
        },
        Err(e) => {
            final_error = format!("{}: {}", current_url, e);
        }
    }

    Err(format!("Pairing failed: {}. Ensure your gateway is reachable and SSL cert is valid.", final_error))
}

#[tauri::command]
async fn mcp_finish_pairing(
    deviceIdentity: serde_json::Value,
    clientIdentity: serde_json::Value,
    bootstrapToken: String,
    state: tauri::State<'_, HandshakeState>,
) -> Result<String, String> {
    println!("[NATIVE] Completing Handshake with verified Bootstrap Token...");
    
    let mut lock = state.socket.lock().await;
    let mut socket = lock.take().ok_or("No active handshake session")?;

    let connect_frame = serde_json::json!({
        "type": "req",
        "method": "connect",
        "id": "pairing-final",
        "params": {
            "minProtocol": 3,
            "maxProtocol": 3,
            "client": clientIdentity,
            "auth": { "bootstrapToken": bootstrapToken },
            "device": deviceIdentity
        }
    });

    socket.send(Message::Text(connect_frame.to_string())).await.map_err(|e| e.to_string())?;

    match tokio::time::timeout(std::time::Duration::from_secs(30), async {
        while let Some(Ok(msg)) = socket.next().await {
            if let Message::Text(text) = msg {
                let data: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
                
                if data["id"] == "pairing-final" {
                    if data["ok"] == true {
                        println!("[NATIVE] Connected successfully!");
                        return Ok(text);
                    } else {
                        let err = data["error"]["message"].as_str().unwrap_or("Pairing failed");
                        
                        // Gateway explicitly requesting pairing flow
                        if err.contains("pairing required") {
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
                        return Err(text.clone());
                    }
                } else if data["id"] == "pairing-real" {
                    if data["ok"] == true {
                        println!("[NATIVE] Pairing SUCCESS! Session bonded.");
                        return Ok(text);
                    } else {
                        let err = data["error"]["message"].as_str().unwrap_or("Pairing rejected");
                        println!("[GATEWAY RAW ERROR] {}", text);
                        return Err(err.to_string());
                    }
                }
            }
        }
        Err("Gateway closed connection".to_string())
    }).await {
        Ok(res) => res,
        Err(_) => Err("Gateway timed out after 30 seconds. Try a fresh setup token.".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
