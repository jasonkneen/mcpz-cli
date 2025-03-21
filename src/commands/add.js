import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import { addServer, getServerByName } from '../utils/config.js';

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
  const env = options.env ? parseKeyValuePairs(options.env) : {};
  
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
