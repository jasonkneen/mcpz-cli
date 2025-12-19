import chalk from 'chalk';
import { getToolboxes, addToolbox as configAddToolbox, removeToolbox as configRemoveToolbox } from '../utils/config.js';

/**
 * Add a new server toolbox
 * @param {string} name - Name of the toolbox
 * @param {Object} options - Command options
 */
export function addToolbox(name, options) {
  if (!name) {
    console.info(chalk.red('Toolbox name is required'));
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

  // Add the toolbox
  const success = configAddToolbox(name, servers);

  if (success) {
    console.info(chalk.green(`Toolbox '${name}' added with servers: ${servers.join(', ')}`));
  } else {
    console.info(chalk.red(`Failed to add toolbox '${name}'`));
  }
}

/**
 * Remove a server toolbox
 * @param {string} name - Name of the toolbox to remove
 */
export function removeToolbox(name) {
  if (!name) {
    console.info(chalk.red('Toolbox name is required'));
    return;
  }

  // Remove the toolbox
  const success = configRemoveToolbox(name);

  if (success) {
    console.info(chalk.green(`Toolbox '${name}' removed`));
  } else {
    console.info(chalk.red(`Toolbox '${name}' not found`));
  }
}

/**
 * List all server toolboxes
 */
export function listToolboxes() {
  const toolboxes = getToolboxes();
  const toolboxNames = Object.keys(toolboxes);

  if (toolboxNames.length === 0) {
    console.info(chalk.yellow('No toolboxes defined'));
    return;
  }

  console.info(chalk.bold('\nToolboxes:'));

  toolboxNames.forEach(name => {
    const servers = toolboxes[name];
    console.info(chalk.cyan(`\n${name}:`));

    if (servers && servers.length > 0) {
      servers.forEach(server => {
        console.info(`  - ${server}`);
      });
    } else {
      console.info(chalk.yellow('  No servers in this toolbox'));
    }
  });

  console.info(''); // Empty line at the end
}

// Backwards compatibility aliases (deprecated)
export { addToolbox as addGroup, removeToolbox as removeGroup, listToolboxes as listGroups };
