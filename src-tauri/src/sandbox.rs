use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::protocol::Message;
use futures_util::{StreamExt, SinkExt};
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};

pub async fn spawn_sandbox(port: u16) -> Result<(), String> {
    let addr = format!("127.0.0.1:{}", port);
    let listener = TcpListener::bind(&addr).await.map_err(|e| e.to_string())?;
    println!("[SANDBOX] Starting local mock agent on {}", addr);

    tokio::spawn(async move {
        while let Ok((stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                if let Ok(mut ws_stream) = accept_async(stream).await {
                    println!("[SANDBOX] New peer connected.");
                    
                    // 1. Emit the connect.challenge
                    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64;
                    let challenge = json!({
                        "type": "event",
                        "event": "connect.challenge",
                        "payload": {
                            "nonce": "sandbox-nonce-123",
                            "ts": ts
                        }
                    });

                    if let Err(e) = ws_stream.send(Message::Text(challenge.to_string())).await {
                        println!("[SANDBOX ERROR] Failed to send challenge: {}", e);
                        return;
                    }

                    // 2. Handle Handshake Sequence
                    while let Some(Ok(msg)) = ws_stream.next().await {
                        if let Message::Text(text) = msg {
                            let data: serde_json::Value = match serde_json::from_str(&text) {
                                Ok(v) => v,
                                Err(_) => continue,
                            };

                            if data["method"] == "connect" && data["id"] == "pairing-final" {
                                let token = data["params"]["auth"]["bootstrapToken"].as_str().unwrap_or("");
                                
                                if token == "FAIL_AUTH" {
                                    println!("[SANDBOX] Simulating AUTH FAILURE.");
                                    let error = json!({
                                        "ok": false,
                                        "id": "pairing-final",
                                        "error": { "message": "unauthorized: invalid gateway token (MOCK ERROR)" }
                                    });
                                    let _ = ws_stream.send(Message::Text(error.to_string())).await;
                                } else if token == "MOCK_TOKEN" {
                                    println!("[SANDBOX] MOCK_TOKEN verified. Bonding session...");
                                    
                                    let response = json!({
                                        "ok": true,
                                        "id": "pairing-final",
                                        "result": {
                                            "token": "sandbox-jwt-session-abc-123",
                                            "agentName": "Sandbox Alex",
                                            "statusUrl": "mock://localhost/status"
                                        }
                                    });
                                    let _ = ws_stream.send(Message::Text(response.to_string())).await;
                                } else {
                                    println!("[SANDBOX] Unauthorized: {} (Expected MOCK_TOKEN)", token);
                                    let error = json!({
                                        "ok": false,
                                        "id": "pairing-final",
                                        "error": { "message": "unauthorized: invalid bootstrap token" }
                                    });
                                    let _ = ws_stream.send(Message::Text(error.to_string())).await;
                                }
                            }
                            
                            // 3. Simple MCP Mocking (Optional: Can add listTools support here)
                            if data["method"] == "tools/list" {
                                let tools = json!({
                                    "jsonrpc": "2.0",
                                    "id": data["id"],
                                    "result": {
                                        "tools": [
                                            { "name": "sandbox_ping", "description": "Tests connectivity to the sandbox." },
                                            { "name": "mock_file_read", "description": "Simulates reading a file from the virtual agent." }
                                        ]
                                    }
                                });
                                let _ = ws_stream.send(Message::Text(tools.to_string())).await;
                            }
                        }
                    }
                    println!("[SANDBOX] Peer disconnected.");
                }
            });
        }
    });

    Ok(())
}
