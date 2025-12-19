import chalk from 'chalk';
import { spawn } from 'child_process';
import path from 'path';
import { getServerByName, isLogging } from '../utils/config.js';

// Security: Allowed commands whitelist
// Only allow known safe executables for MCP servers
const ALLOWED_COMMANDS = new Set([
  'node', 'npx', 'npm', 'python', 'python3', 'uvx', 'uv',
  'deno', 'bun', 'ruby', 'java', 'dotnet'
]);

// Security: Validate command is in whitelist or is an absolute path to allowed binary
function validateCommand(command) {
  if (!command || typeof command !== 'string') {
    return { valid: false, reason: 'Command is required' };
  }

  // Get the base command (first part before any arguments)
  const baseCommand = path.basename(command);

  // Check if it's in the whitelist
  if (ALLOWED_COMMANDS.has(baseCommand)) {
    return { valid: true };
  }

  // Check if it's an absolute path to one of the allowed commands
  if (path.isAbsolute(command)) {
    const basename = path.basename(command);
    if (ALLOWED_COMMANDS.has(basename)) {
      return { valid: true };
    }
  }

  // Security: Block path traversal attempts
  if (command.includes('..') || command.includes('~')) {
    return { valid: false, reason: 'Path traversal not allowed' };
  }

  // Security: Block shell metacharacters
  if (/[;&|`$(){}[\]<>\\]/.test(command)) {
    return { valid: false, reason: 'Shell metacharacters not allowed' };
  }

  return { valid: false, reason: `Command "${baseCommand}" not in allowed list. Allowed: ${[...ALLOWED_COMMANDS].join(', ')}` };
}

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

  // Security: Validate command against whitelist
  const validation = validateCommand(server.command);
  if (!validation.valid) {
    console.info(chalk.red(`Error: ${validation.reason}`));
    return;
  }

  if (isLogging()) {
    // Intentionally empty for logging in debug mode
  }

  // Start the server process
  // Security: spawn() without shell:true is safer than exec()
  const childProcess = spawn(server.command, server.args || [], {
    env: { ...process.env, ...(server.env || {}) },
    stdio: 'inherit'
  });
  
  // Handle process events
  childProcess.on('error', (error) => {
    console.info(chalk.red(`Error starting MCP server: ${error.message}`));
  });

  childProcess.on('exit', (code) => {
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
    childProcess.kill();
  });
}
