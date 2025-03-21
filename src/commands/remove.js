import chalk from 'chalk';
import { removeServer, getServerByName } from '../utils/config.js';
import log from '../utils/log.js';

/**
 * Remove an MCP configuration
 * @param {string} name - The name of the MCP to remove
 */
export function remove(name) {
  if (!name) {
    log.error('Name is required for removing an MCP configuration');
    return;
  }
  
  // Check if server exists
  const server = getServerByName(name);
  if (!server) {
    log.error(`No MCP configuration found with name "${name}"`);
    return;
  }
  
  // Remove server from configuration
  if (removeServer(name)) {
    // Success output to stdout since it's user-facing information
    log.info(chalk.green(`Successfully removed MCP configuration: ${name}`));
  } else {
    // Error output to stderr
    log.error(`Failed to remove MCP configuration: ${name}`);
  }
}
