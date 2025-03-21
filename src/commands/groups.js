import chalk from 'chalk';
import { getGroups, addGroup as configAddGroup, removeGroup as configRemoveGroup } from '../utils/config.js';

/**
 * Add a new server group
 * @param {string} name - Name of the group
 * @param {Object} options - Command options
 */
export function addGroup(name, options) {
  if (!name) {
    console.info(chalk.red('Group name is required'));
    return;
  }

  if (!options.servers) {
    console.info(chalk.red('Server list is required (--servers)'));
    return;
  }

  // Parse server list
  const servers = options.servers.split(',').map(s => s.trim()).filter(Boolean);
  
  if (servers.length === 0) {
    console.info(chalk.red('Server list cannot be empty'));
    return;
  }

  // Add the group
  const success = configAddGroup(name, servers);
  
  if (success) {
    console.info(chalk.green(`Group '${name}' added with servers: ${servers.join(', ')}`));
  } else {
    console.info(chalk.red(`Failed to add group '${name}'`));
  }
}

/**
 * Remove a server group
 * @param {string} name - Name of the group to remove
 */
export function removeGroup(name) {
  if (!name) {
    console.info(chalk.red('Group name is required'));
    return;
  }

  // Remove the group
  const success = configRemoveGroup(name);
  
  if (success) {
    console.info(chalk.green(`Group '${name}' removed`));
  } else {
    console.info(chalk.red(`Group '${name}' not found`));
  }
}

/**
 * List all server groups
 */
export function listGroups() {
  const groups = getGroups();
  const groupNames = Object.keys(groups);
  
  if (groupNames.length === 0) {
    console.info(chalk.yellow('No server groups defined'));
    return;
  }

  console.info(chalk.bold('\nServer Groups:'));
  
  groupNames.forEach(name => {
    const servers = groups[name];
    console.info(chalk.cyan(`\n${name}:`));
    
    if (servers && servers.length > 0) {
      servers.forEach(server => {
        console.info(`  - ${server}`);
      });
    } else {
      console.info(chalk.yellow('  No servers in this group'));
    }
  });
  
  console.info(''); // Empty line at the end
}
