import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { readConfig, writeConfig, setCustomLoadPath, setCustomSavePath } from '../utils/config.js';

/**
 * Configure the CLI
 * @param {Object} options - Command options
 */
export function config(options) {
  // Handle load path
  if (options.load) {
    const loadPath = path.resolve(options.load);
    setCustomLoadPath(loadPath);
    
    // Verify the file exists
    if (!fs.existsSync(loadPath)) {
      console.log(chalk.yellow(`Warning: Config file ${loadPath} does not exist. It will be created when needed.`));
    } else {
      console.log(chalk.green(`Now loading configuration from: ${loadPath}`));
    }
  }
  
  // Handle save path
  if (options.save) {
    const savePath = path.resolve(options.save);
    setCustomSavePath(savePath);
    console.log(chalk.green(`Now saving configuration to: ${savePath}`));
    
    // If we have a config loaded, save it to the new path
    const currentConfig = readConfig();
    if (writeConfig(currentConfig)) {
      console.log(chalk.green('Configuration saved to new location'));
    }
  }
  
  // Show current config
  if (!options.load && !options.save) {
    console.log(chalk.blue('Current configuration:'));
    const config = readConfig();
    
    console.log(chalk.bold('Servers:'));
    if (config.servers && config.servers.length > 0) {
      config.servers.forEach(server => {
        console.log(`  ${chalk.green(server.name)}`);
        console.log(`    Command: ${server.command}`);
        console.log(`    Args: ${Array.isArray(server.args) ? server.args.join(', ') : 'none'}`);
        console.log(`    Env: ${server.env ? JSON.stringify(server.env) : 'none'}`);
      });
    } else {
      console.log('  No servers configured');
    }
    
    console.log(chalk.bold('Groups:'));
    if (config.groups && Object.keys(config.groups).length > 0) {
      Object.entries(config.groups).forEach(([name, servers]) => {
        console.log(`  ${chalk.green(name)}: ${servers.join(', ')}`);
      });
    } else {
      console.log('  No groups configured');
    }
  }
}

/**
 * Export both named and default
 */
export default config;