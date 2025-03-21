#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current file
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Install the CLI package globally for development
 */
function installDev() {
  try {
    console.info('Installing mcpz.run CLI for development...');
    
    // Run npm link to create a global symlink
    execSync('npm link', {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    console.info('\nmcpz.run CLI installed successfully!');
    console.info('\nYou can now use the following commands:');
    console.info('  mcpz run');
    console.info('  mcpz add <name> --command <command> --args <args> --env <env>');
    console.info('  mcpz remove <name>');
    console.info('  mcpz list');
    console.info('  mcpz use <name>');
    console.info('  mcpz help');
  } catch (error) {
    console.info('Error installing mcpz.run CLI:', error.message);
    process.exit(1);
  }
}

// Run the installation
installDev();
