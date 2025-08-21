/**
 * Debug ResearchAgent issue
 */

const http = require('http');

async function debugResearchAgent() {
  // First get CSRF token
  const csrf = await new Promise((resolve) => {
    http.get('http://localhost:3001/api/csrf-token', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        resolve({
          token: parsed.token,
          cookies: res.headers['set-cookie']?.join('; ') || ''
        });
      });
    }).on('error', () => resolve({ token: 'test', cookies: '' }));
  });

  // Test ResearchAgent
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      "0": {
        json: {
          agentType: "ResearchAgent",
          task: "What is Node.js?",
          context: {}
        }
      }
    });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/trpc/agent.execute?batch=1',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        'x-csrf-token': csrf.token,
        'Cookie': csrf.cookies
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        console.log('Full response:', JSON.stringify(result, null, 2));
        
        if (result[0]?.error) {
          console.log('\n=== ERROR DETAILS ===');
          console.log('Message:', result[0].error.message);
          console.log('Stack:', result[0].error.stack);
        }
        
        if (result[0]?.result?.data?.json) {
          const agentResult = result[0].result.data.json;
          console.log('\n=== AGENT RESULT ===');
          console.log('Success:', agentResult.success);
          console.log('Error:', agentResult.error);
          
          if (agentResult.metadata) {
            console.log('Metadata:', agentResult.metadata);
          }
        }
        
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

// Wait for server to start then run debug
setTimeout(() => {
  console.log('Debugging ResearchAgent...\n');
  debugResearchAgent();
}, 3000);