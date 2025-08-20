const { execSync } = require('child_process');
const path = require('path');

const projectRoot = '/home/pricepro2006/CrewAI_Team';

console.log('Installing missing dependencies...');

const packages = [
  'pako',
  '@types/pako',
  'http-proxy-middleware',
  '@types/http-proxy-middleware',
  '@grpc/grpc-js',
  '@grpc/proto-loader',
  'fastify',
  '@fastify/cors',
  '@fastify/helmet',
  '@fastify/rate-limit',
  'nodemailer',
  '@types/nodemailer',
  'discord.js',
  'react-hot-toast'
];

try {
  // Change to project directory
  process.chdir(projectRoot);
  
  // Install regular dependencies
  const deps = packages.filter(pkg => !pkg.startsWith('@types/'));
  const devDeps = packages.filter(pkg => pkg.startsWith('@types/'));
  
  console.log('Installing regular dependencies...');
  execSync(`npm install ${deps.join(' ')}`, { stdio: 'inherit' });
  
  console.log('Installing type definitions...');
  execSync(`npm install --save-dev ${devDeps.join(' ')}`, { stdio: 'inherit' });
  
  console.log('Running npm install to ensure consistency...');
  execSync('npm install', { stdio: 'inherit' });
  
  console.log('✅ All dependencies installed successfully!');
  
} catch (error) {
  console.error('❌ Installation failed:', error.message);
  process.exit(1);
}