/**
 * Test WebSocket functionality
 */

import WebSocket from "ws";

const testWebSocket = async () => {
  console.log("Testing WebSocket connection...");

  const ws = new WebSocket("ws://localhost:3001/ws/walmart");

  ws.on("open", () => {
    console.log("✅ WebSocket connected");
    
    // Send auth message
    ws.send(JSON.stringify({
      type: "auth",
      userId: "test-user",
      sessionId: "test-session"
    }));

    // Send a ping
    setTimeout(() => {
      ws.send(JSON.stringify({ type: "ping" }));
    }, 1000);

    // Close after 3 seconds
    setTimeout(() => {
      ws.close();
      process.exit(0);
    }, 3000);
  });

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());
    console.log("📨 Received:", message);
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error.message);
    process.exit(1);
  });

  ws.on("close", () => {
    console.log("Connection closed");
  });
};

// Wait for server to be ready
setTimeout(() => {
  testWebSocket();
}, 2000);

console.log("Waiting for server to start...");