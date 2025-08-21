const WebSocket = require('ws');

console.log('🔍 Debugging /ws endpoint failure...\n');

// Test connection to failing endpoint with detailed error handling
const ws = new WebSocket('ws://localhost:8080/ws');

ws.on('open', function open() {
  console.log('✅ Connection established to /ws');
  
  // Send test message
  ws.send(JSON.stringify({
    type: 'test',
    message: 'Debug connection test'
  }));
});

ws.on('message', function message(data) {
  console.log('📨 Received:', data.toString());
  ws.close();
});

ws.on('error', function error(err) {
  console.log('❌ WebSocket Error Details:');
  console.log('  Error Code:', err.code);
  console.log('  Error Message:', err.message);
  console.log('  Stack:', err.stack);
  
  if (err.message.includes('400')) {
    console.log('\n🔧 Diagnosis: HTTP 400 indicates server rejected the WebSocket upgrade');
    console.log('   Possible causes:');
    console.log('   - Missing required headers');
    console.log('   - Authentication required');  
    console.log('   - Server-side error in upgrade handler');
    console.log('   - Route not properly configured');
  }
});

ws.on('close', function close(code, reason) {
  console.log('🔌 Connection closed');
  console.log('  Code:', code);
  console.log('  Reason:', reason?.toString() || 'No reason provided');
  
  // Test the working endpoint for comparison
  console.log('\n🔄 Testing working endpoint /ws/walmart for comparison...');
  
  const workingWs = new WebSocket('ws://localhost:8080/ws/walmart');
  
  workingWs.on('open', function() {
    console.log('✅ /ws/walmart connected successfully');
    workingWs.close();
  });
  
  workingWs.on('error', function(err) {
    console.log('❌ /ws/walmart also failing:', err.message);
  });
});

// Auto-close after 5 seconds if no response
setTimeout(() => {
  if (ws.readyState !== WebSocket.CLOSED) {
    console.log('⏰ Timeout - closing connection');
    ws.close();
  }
}, 5000);