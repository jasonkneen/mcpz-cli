import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import { addServer, getServerByName } from '../utils/config.js';

// Security: Blocked environment variable names
// Block dangerous env vars that could enable privilege escalation or code injection
const BLOCKED_ENV_VARS = new Set([
  'PATH', 'LD_LIBRARY_PATH', 'LD_PRELOAD', 'DYLD_LIBRARY_PATH', 'DYLD_INSERT_LIBRARIES',
  'PYTHONPATH', 'RUBYLIB', 'PERL5LIB', 'NODE_PATH',
  'HOME', 'USER', 'LOGNAME', 'SHELL',
  'SUDO_USER', 'SUDO_UID', 'SUDO_GID', 'SUDO_COMMAND',
  'SSH_AUTH_SOCK', 'SSH_AGENT_PID',
  'GPG_AGENT_INFO', 'GNUPGHOME',
  'TERM', 'DISPLAY', 'XAUTHORITY'
]);

/**
 * Security: Validate server name
 * @param {string} name - The server name to validate
 * @returns {{valid: boolean, reason?: string}}
 */
function validateServerName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, reason: 'Server name is required' };
  }
  if (name.length > 64) {
    return { valid: false, reason: 'Server name must be 64 characters or less' };
  }
  // Only allow alphanumeric, underscore, dash, and space
  if (!/^[a-zA-Z0-9_\- ]+$/.test(name)) {
    return { valid: false, reason: 'Server name can only contain letters, numbers, underscores, dashes, and spaces' };
  }
  // Block path traversal
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return { valid: false, reason: 'Server name cannot contain path characters' };
  }
  return { valid: true };
}

/**
 * Security: Validate and filter environment variables
 * Uses blocklist approach - allow everything except dangerous system vars
 * @param {Object} env - The environment variables to validate
 * @returns {{filtered: Object, blocked: string[]}}
 */
function validateEnv(env) {
  const filtered = {};
  const blocked = [];

  for (const [key, value] of Object.entries(env)) {
    // Block dangerous system environment variables
    if (BLOCKED_ENV_VARS.has(key)) {
      blocked.push(key);
    } else {
      // Allow everything else
      filtered[key] = value;
    }
  }

  return { filtered, blocked };
}

/**
 * Parse comma-separated key=value pairs into an object
 * @param {string} str - The string to parse
 * @returns {Object} The parsed object
 */
function parseKeyValuePairs(str) {
  if (!str) return {};

  const result = {};
  const pairs = str.split(',');

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value) {
      result[key.trim()] = value.trim();
    }
  }

  return result;
}

/**
 * Parse comma-separated values into an array
 * @param {string} str - The string to parse
 * @returns {string[]} The parsed array
 */
function parseCommaSeparatedValues(str) {
  if (!str) return [];
  return str.split(',').map(item => item.trim());
}

/**
 * Add a new MCP configuration
 * @param {string} name - The name of the MCP
 * @param {Object} options - Command options
 */
export function add(name, options) {
  if (!name) {
    console.info(chalk.red('Error: Name is required'));
    return;
  }

  // Security: Validate server name
  const nameValidation = validateServerName(name);
  if (!nameValidation.valid) {
    console.info(chalk.red(`Error: ${nameValidation.reason}`));
    return;
  }

  if (!options.command) {
    console.info(chalk.red('Error: Command is required'));
    return;
  }

  // Check if server with same name already exists
  const existingServer = getServerByName(name);
  if (existingServer) {
    console.info(chalk.yellow(`Server with name "${name}" already exists. Updating configuration...`));
  }

  // Parse arguments and environment variables
  const args = options.args ? parseCommaSeparatedValues(options.args) : [];
  const rawEnv = options.env ? parseKeyValuePairs(options.env) : {};

  // Security: Validate and filter environment variables
  const { filtered: env, blocked } = validateEnv(rawEnv);
  if (blocked.length > 0) {
    console.info(chalk.yellow(`Warning: The following env vars were blocked for security: ${blocked.join(', ')}`));
    console.info(chalk.gray('Blocked vars: PATH, LD_LIBRARY_PATH, HOME, etc. (system/security sensitive)'));
  }
  
  // Create server object
  const server = {
    id: existingServer?.id || uuidv4(),
    name,
    command: options.command,
    args,
    env,
    enabled: true,
    type: 'process'
  };
  
  // Add server to configuration
  if (addServer(server)) {
    console.info(chalk.green(`Successfully ${existingServer ? 'updated' : 'added'} MCP configuration: ${name}`));
  } else {
    console.info(chalk.red(`Failed to ${existingServer ? 'update' : 'add'} MCP configuration`));
  }
}
