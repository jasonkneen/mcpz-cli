import chalk from 'chalk';
import { spawn } from 'child_process';
import { getServerByName, isLogging } from '../utils/config.js';

/**
 * Use a specific MCP configuration
 * @param {string} name - The name of the MCP to use
 */
export function use(name) {
  if (!name) {
    console.info(chalk.red('Error: Name is required'));
    return;
  }
  
  // Check if server exists
  const server = getServerByName(name);
  if (!server) {
    console.info(chalk.red(`Error: No MCP configuration found with name "${name}"`));
    return;
  }
  
  // Check if server is enabled
  if (!server.enabled) {
    console.info(chalk.red(`Error: MCP configuration "${name}" is disabled`));
    return;
  }
  
  // Check if command is provided
  if (!server.command) {
    console.info(chalk.red(`Error: No command specified for MCP configuration "${name}"`));
    return;
  }
  
  if (isLogging()) {
    // Intentionally empty for logging in debug mode
  }
  
  // Start the server process
  const process = spawn(server.command, server.args || [], {
    env: { ...process.env, ...(server.env || {}) },
    stdio: 'inherit'
  });
  
  // Handle process events
  process.on('error', (error) => {
    console.info(chalk.red(`Error starting MCP server: ${error.message}`));
  });
  
  process.on('exit', (code) => {
    if (code === 0) {
      if (isLogging()) {
        // Intentionally empty for logging in debug mode
      }
    } else {
      console.info(chalk.red(`MCP server "${name}" exited with code ${code}`));
    }
  });
  
  // Handle SIGINT to gracefully shut down the server
  process.on('SIGINT', () => {
    if (isLogging()) {
      console.info(chalk.yellow(`Shutting down MCP server "${name}"...`));
    }
    process.kill();
  });
}
