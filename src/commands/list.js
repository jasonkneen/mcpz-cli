import chalk from 'chalk';
import { readConfig } from '../utils/config.js';

/**
 * List all MCP configurations
 */
export function list() {
  const config = readConfig();
  
  if (!config.servers || config.servers.length === 0) {
    console.info(chalk.yellow('No MCP configurations found'));
    return;
  }
  
  console.info(chalk.bold('\nMCP Configurations:'));
  console.info(chalk.dim('-------------------'));
  
  for (const server of config.servers) {
    console.info(chalk.bold(`\n${server.name}`));
    console.info(chalk.dim('  ID:       ') + server.id);
    console.info(chalk.dim('  Command:  ') + server.command);
    console.info(chalk.dim('  Args:     ') + (server.args && server.args.length > 0 ? server.args.join(', ') : 'none'));
    console.info(chalk.dim('  Env:      ') + (server.env && Object.keys(server.env).length > 0 ? 
      Object.entries(server.env).map(([key, value]) => `${key}=${value}`).join(', ') : 'none'));
    console.info(chalk.dim('  Enabled:  ') + (server.enabled ? chalk.green('yes') : chalk.red('no')));
    console.info(chalk.dim('  Type:     ') + (server.type || 'process'));
  }
  
  console.info('\n');
}
