import chalk from 'chalk';
import { readConfig } from '../utils/config.js';

/**
 * List all MCP tools
 * @param {string} [serverName] - Optional server name to filter tools
 */
export function tools(serverName) {
  const config = readConfig();
  
  if (!config.servers || config.servers.length === 0) {
    console.info(chalk.yellow('No MCP configurations found'));
    return;
  }
  
  console.info(chalk.bold('\nMCP Tools:'));
  console.info(chalk.dim('----------'));
  
  let filteredServers = config.servers;
  
  // Filter by server name if provided
  if (serverName) {
    filteredServers = config.servers.filter(server => 
      server.name.toLowerCase() === serverName.toLowerCase() ||
      server.id.toLowerCase() === serverName.toLowerCase()
    );
    
    if (filteredServers.length === 0) {
      console.info(chalk.yellow(`No MCP server found with name "${serverName}"`));
      return;
    }
  }
  
  // Display tools for each server
  let toolsFound = false;
  
  for (const server of filteredServers) {
    if (!server.enabled) {
      continue; // Skip disabled servers
    }
    
    console.info(chalk.bold(`\nServer: ${server.name}`));
    
    // In a real implementation, we would query the server for its tools
    // For now, we'll just show a placeholder message
    console.info(chalk.dim('  Tools for this server will be displayed when it is running.'));
    console.info(chalk.dim('  Use the following command to start the server:'));
    console.info(chalk.dim(`  $ mcps use ${server.name}`));
    
    toolsFound = true;
  }
  
  if (!toolsFound) {
    console.info(chalk.yellow('No enabled servers found'));
  }
  
  console.info('\n');
}