const { execSync } = require('child_process');
const fs = require('fs');

// Change to project directory
process.chdir('/home/pricepro2006/CrewAI_Team');

// Check if package.json exists
if (!fs.existsSync('package.json')) {
  console.error('package.json not found');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// List of packages that are definitely missing based on TypeScript errors
const missingPackages = [
  'http-proxy-middleware',
  '@grpc/grpc-js', 
  '@grpc/proto-loader',
  'fastify',
  '@fastify/cors',
  '@fastify/helmet', 
  '@fastify/rate-limit',
  'nodemailer',
  'discord.js',
  'react-hot-toast'
];

const missingDevPackages = [
  '@types/http-proxy-middleware',
  '@types/nodemailer'
];

// Filter out packages that are already in package.json
const toInstall = missingPackages.filter(pkg => 
  !packageJson.dependencies?.[pkg] && !packageJson.devDependencies?.[pkg]
);

const devToInstall = missingDevPackages.filter(pkg => 
  !packageJson.devDependencies?.[pkg]
);

console.log('Missing packages to install:', toInstall);
console.log('Missing dev packages to install:', devToInstall);

try {
  if (toInstall.length > 0) {
    console.log('Installing regular dependencies...');
    execSync(`npm install ${toInstall.join(' ')}`, { stdio: 'inherit' });
  }
  
  if (devToInstall.length > 0) {
    console.log('Installing dev dependencies...');
    execSync(`npm install --save-dev ${devToInstall.join(' ')}`, { stdio: 'inherit' });
  }
  
  if (toInstall.length === 0 && devToInstall.length === 0) {
    console.log('All packages are already present in package.json');
    console.log('Running npm install to ensure they are installed...');
    execSync('npm install', { stdio: 'inherit' });
  }
  
  console.log('✅ Installation completed!');
} catch (error) {
  console.error('❌ Installation failed:', error.message);
}