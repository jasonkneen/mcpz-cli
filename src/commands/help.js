import chalk from 'chalk';

/**
 * Display help information
 */
export function help() {
  console.info(chalk.bold('\nmcpz.run CLI'));
  console.info(chalk.dim('---------------'));
  console.info('\nUsage: mcpz [command] [options]');
  
  console.info('\nCommands:');
  console.info('  run                  Start mcpz.run as a stdio server');
  console.info('  add <name>           Add a new MCP configuration');
  console.info('  remove <name>        Remove an MCP configuration');
  console.info('  list                 List all MCP configurations');
  console.info('  run <name>           Use a specific MCP configuration');
  console.info('  help                 Display this help information');
  
  console.info('\nOptions for add command:');
  console.info('  -c, --command <cmd>  Command to run the MCP server');
  console.info('  -a, --args <args>    Arguments for the command (comma-separated)');
  console.info('  -e, --env <env>      Environment variables (key=value,key2=value2)');
  
  console.info('\nExamples:');
  console.info('  mcpz run');
  console.info('  mcpz add "GPT Server" --command "node" --args "server.js"');
  console.info('  mcpz list');
  console.info('  mcpz run "GPT Server"');
  
  console.info('\n');
}
