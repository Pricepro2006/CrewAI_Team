// Quick test to see which imports are working
console.log('Testing imports...');

const tests = [
  { name: 'pako', test: () => require('pako') },
  { name: 'http-proxy-middleware', test: () => require('http-proxy-middleware') },
  { name: '@grpc/grpc-js', test: () => require('@grpc/grpc-js') },
  { name: '@grpc/proto-loader', test: () => require('@grpc/proto-loader') },
  { name: 'fastify', test: () => require('fastify') },
  { name: '@fastify/cors', test: () => require('@fastify/cors') },
  { name: '@fastify/helmet', test: () => require('@fastify/helmet') },
  { name: '@fastify/rate-limit', test: () => require('@fastify/rate-limit') },
  { name: 'nodemailer', test: () => require('nodemailer') },
  { name: 'discord.js', test: () => require('discord.js') },
  { name: 'react-hot-toast', test: () => require('react-hot-toast') }
];

tests.forEach(({ name, test }) => {
  try {
    test();
    console.log(`✅ ${name} - OK`);
  } catch (error) {
    console.log(`❌ ${name} - Missing: ${error.message}`);
  }
});

console.log('Import test completed.');