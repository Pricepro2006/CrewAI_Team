const { execSync } = require('child_process');

console.log('Installing missing dependencies...');

try {
  console.log('Installing pako...');
  execSync('npm install pako', { stdio: 'inherit', cwd: '/home/pricepro2006/CrewAI_Team' });
  
  console.log('Installing @types/pako...');
  execSync('npm install --save-dev @types/pako', { stdio: 'inherit', cwd: '/home/pricepro2006/CrewAI_Team' });
  
  console.log('Checking installations...');
  execSync('npm list pako', { stdio: 'inherit', cwd: '/home/pricepro2006/CrewAI_Team' });
  execSync('npm list @types/pako', { stdio: 'inherit', cwd: '/home/pricepro2006/CrewAI_Team' });
  
  console.log('Dependencies installed successfully!');
} catch (error) {
  console.error('Installation failed:', error.message);
}