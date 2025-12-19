import chalk from 'chalk';
import {
  listPlugins,
  listMarketplaces,
  addMarketplace,
  removeMarketplace,
  installPlugin,
  uninstallPlugin,
  getPluginsDir,
  ensurePluginsDir,
  fetchMarketplaceManifest
} from '../utils/plugins.js';

/**
 * List all installed plugins
 */
export function list() {
  const plugins = listPlugins();

  if (plugins.length === 0) {
    console.info(chalk.yellow('No plugins installed'));
    console.info(chalk.gray(`Plugins directory: ${getPluginsDir()}`));
    console.info(chalk.gray('Add a marketplace: mcpz plugin marketplace add <repo>'));
    return;
  }

  console.info(chalk.bold('\nInstalled Plugins:'));
  console.info(chalk.gray('─'.repeat(60)));

  plugins.forEach(plugin => {
    console.info(chalk.cyan(`\n  ${plugin.name}`), chalk.gray(`v${plugin.version || '?'}`));
    if (plugin.description) {
      console.info(chalk.gray(`    ${plugin.description}`));
    }

    // Show components
    const components = [];
    if (plugin.hasCommands) components.push('commands');
    if (plugin.hasAgents) components.push('agents');
    if (plugin.hasSkills) components.push('skills');
    if (plugin.hasHooks) components.push('hooks');
    if (plugin.hasMcp) components.push('mcp');

    if (components.length > 0) {
      console.info(chalk.gray(`    Components: ${components.join(', ')}`));
    }
  });

  console.info('');
}

/**
 * List configured marketplaces
 */
export function marketplaceList() {
  const marketplaces = listMarketplaces();

  if (marketplaces.length === 0) {
    console.info(chalk.yellow('No marketplaces configured'));
    console.info(chalk.gray('Add a marketplace: mcpz plugin marketplace add <user/repo>'));
    return;
  }

  console.info(chalk.bold('\nConfigured Marketplaces:'));
  console.info(chalk.gray('─'.repeat(60)));

  marketplaces.forEach(m => {
    console.info(chalk.cyan(`  ${m.url}`));
    console.info(chalk.gray(`    Added: ${new Date(m.addedAt).toLocaleDateString()}`));
  });

  console.info('');
}

/**
 * Add a marketplace
 * @param {string} repo - Repository URL or GitHub shorthand
 */
export async function marketplaceAdd(repo) {
  if (!repo) {
    console.info(chalk.red('Repository URL or shorthand is required'));
    console.info(chalk.gray('Example: mcpz plugin marketplace add anthropics/claude-code'));
    return;
  }

  await addMarketplace(repo);
}

/**
 * Remove a marketplace
 * @param {string} repo - Repository URL or GitHub shorthand
 */
export function marketplaceRemove(repo) {
  if (!repo) {
    console.info(chalk.red('Repository URL or shorthand is required'));
    return;
  }

  removeMarketplace(repo);
}

/**
 * Browse plugins in a marketplace
 * @param {string} repo - Repository URL or GitHub shorthand
 */
export async function browse(repo) {
  if (!repo) {
    console.info(chalk.red('Repository URL or shorthand is required'));
    return;
  }

  // Normalize URL
  let url = repo;
  if (!repo.includes('://')) {
    url = `https://github.com/${repo}`;
  }

  console.info(chalk.gray(`Fetching marketplace from ${url}...`));

  const manifest = await fetchMarketplaceManifest(url);

  if (!manifest) {
    console.info(chalk.red('Could not fetch marketplace manifest'));
    return;
  }

  console.info(chalk.bold(`\n${manifest.name || 'Marketplace'}`));
  if (manifest.description) {
    console.info(chalk.gray(manifest.description));
  }
  console.info(chalk.gray('─'.repeat(60)));

  if (!manifest.plugins || manifest.plugins.length === 0) {
    console.info(chalk.yellow('No plugins available'));
    return;
  }

  manifest.plugins.forEach(plugin => {
    console.info(chalk.cyan(`\n  ${plugin.name}`), chalk.gray(`v${plugin.version || '?'}`));
    if (plugin.description) {
      console.info(chalk.gray(`    ${plugin.description}`));
    }
    if (plugin.category) {
      console.info(chalk.gray(`    Category: ${plugin.category}`));
    }
  });

  console.info(chalk.gray(`\nInstall with: mcpz plugin install <name> --from ${repo}`));
  console.info('');
}

/**
 * Install a plugin
 * @param {string} name - Plugin name
 * @param {Object} options - Command options
 */
export async function install(name, options) {
  if (!name) {
    console.info(chalk.red('Plugin name is required'));
    return;
  }

  if (!options.from) {
    // Try to find in configured marketplaces
    const marketplaces = listMarketplaces();

    if (marketplaces.length === 0) {
      console.info(chalk.red('No marketplaces configured. Use --from to specify a source.'));
      console.info(chalk.gray('Or add a marketplace: mcpz plugin marketplace add <repo>'));
      return;
    }

    // Search all marketplaces for the plugin
    for (const marketplace of marketplaces) {
      const manifest = await fetchMarketplaceManifest(marketplace.url);
      if (manifest?.plugins?.some(p => p.name === name)) {
        await installPlugin(name, marketplace.url);
        return;
      }
    }

    console.info(chalk.red(`Plugin '${name}' not found in configured marketplaces`));
    return;
  }

  await installPlugin(name, options.from);
}

/**
 * Uninstall a plugin
 * @param {string} name - Plugin name
 */
export function uninstall(name) {
  if (!name) {
    console.info(chalk.red('Plugin name is required'));
    return;
  }

  uninstallPlugin(name);
}

/**
 * Show the plugins directory path
 */
export function dir() {
  ensurePluginsDir();
  console.info(chalk.bold('Plugins Directory:'));
  console.info(`  ${getPluginsDir()}`);
}
