const { execSync } = require('child_process');

console.log('Starting dependency installation...');

try {
  // Change to the project directory
  process.chdir('/home/pricepro2006/CrewAI_Team');
  
  // Install pako first (the main one we need)
  console.log('Installing pako...');
  execSync('npm install pako', { stdio: 'inherit' });
  
  console.log('Installing pako types...');
  execSync('npm install --save-dev @types/pako', { stdio: 'inherit' });
  
  console.log('Installing other missing packages...');
  execSync('npm install http-proxy-middleware @grpc/grpc-js @grpc/proto-loader fastify @fastify/cors @fastify/helmet @fastify/rate-limit nodemailer discord.js react-hot-toast', { stdio: 'inherit' });
  
  console.log('Installing additional type definitions...');
  execSync('npm install --save-dev @types/http-proxy-middleware @types/nodemailer', { stdio: 'inherit' });
  
  console.log('✅ Installation completed successfully!');
  
  // Verify pako is now available
  console.log('Verifying pako installation...');
  try {
    require('pako');
    console.log('✅ pako is now available');
  } catch (e) {
    console.log('❌ pako still not available:', e.message);
  }
  
} catch (error) {
  console.error('❌ Installation error:', error.message);
}