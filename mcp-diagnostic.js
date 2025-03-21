#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';

// Create a log file for diagnostic information
const logFile = fs.createWriteStream('./mcp-debug.log', { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  logFile.write(logMessage);
}

log('MCP Diagnostic wrapper started');

// Function to check if a string is valid JSON
function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

// Get the command and arguments to run
const [, , command, ...args] = process.argv;

if (!command) {
  console.error('Error: Command is required');
  log('Error: Command is required');
  process.exit(1);
}

log(`Running command: ${command} ${args.join(' ')}`);

// Start the process
const childProcess = spawn(command, args, {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Log the process ID
log(`Process started with PID: ${childProcess.pid}`);

// Process stdout
childProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Check if the line is valid JSON
    const isJSON = isValidJSON(line);
    
    // Log the line for diagnostic purposes
    log(`STDOUT: ${isJSON ? '[VALID JSON]' : '[NOT JSON]'} ${line}`);
    
    // Pass through to parent process
    process.stdout.write(line + '\n');
  }
});

// Process stderr
childProcess.stderr.on('data', (data) => {
  const lines = data.toString().split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Log the line for diagnostic purposes
    log(`STDERR: ${line}`);
    
    // Pass through to parent process
    process.stderr.write(line + '\n');
  }
});

// Handle process exit
childProcess.on('exit', (code) => {
  log(`Process exited with code: ${code}`);
  logFile.end();
  process.exit(code);
});

// Handle errors
childProcess.on('error', (error) => {
  log(`Process error: ${error.message}`);
  console.error(`Error: ${error.message}`);
  logFile.end();
  process.exit(1);
});

// Handle SIGINT to gracefully shut down
process.on('SIGINT', () => {
  log('Received SIGINT, shutting down');
  childProcess.kill('SIGINT');
});