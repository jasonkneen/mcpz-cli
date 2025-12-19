import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFilePromise = promisify(execFile);

/**
 * Plugins Manager - Discover and manage Claude Code style plugins
 * Based on Claude Code marketplace plugin format
 */

// Default plugins directory
const PLUGINS_DIR = path.join(os.homedir(), '.mcpz', 'plugins');
const MARKETPLACES_FILE = path.join(os.homedir(), '.mcpz', 'marketplaces.json');

/**
 * Ensure plugins directory exists
 */
export function ensurePluginsDir() {
  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  }
}

/**
 * Load plugin.json from a plugin directory
 * @param {string} pluginPath - Path to plugin directory
 * @returns {Object|null} Plugin manifest or null
 */
export function loadPluginManifest(pluginPath) {
  const manifestPath = path.join(pluginPath, '.claude-plugin', 'plugin.json');

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (error) {
    console.error(`Error loading plugin manifest from ${manifestPath}: ${error.message}`);
    return null;
  }
}

/**
 * Discover all installed plugins
 * @param {string} pluginsDir - Plugins directory
 * @returns {Object[]} Array of plugin objects
 */
export function discoverPlugins(pluginsDir = PLUGINS_DIR) {
  const plugins = [];

  if (!fs.existsSync(pluginsDir)) {
    return plugins;
  }

  try {
    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginPath = path.join(pluginsDir, entry.name);
        const manifest = loadPluginManifest(pluginPath);

        if (manifest) {
          plugins.push({
            ...manifest,
            path: pluginPath,
            dirName: entry.name,
            // Check what components are available
            hasCommands: fs.existsSync(path.join(pluginPath, 'commands')),
            hasAgents: fs.existsSync(path.join(pluginPath, 'agents')),
            hasSkills: fs.existsSync(path.join(pluginPath, 'skills')),
            hasHooks: fs.existsSync(path.join(pluginPath, 'hooks')),
            hasMcp: fs.existsSync(path.join(pluginPath, '.mcp.json'))
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error discovering plugins: ${error.message}`);
  }

  return plugins;
}

/**
 * Load marketplace configuration
 * @returns {Object} Marketplaces config
 */
export function loadMarketplaces() {
  if (!fs.existsSync(MARKETPLACES_FILE)) {
    return { marketplaces: [] };
  }

  try {
    return JSON.parse(fs.readFileSync(MARKETPLACES_FILE, 'utf-8'));
  } catch (error) {
    console.error(`Error loading marketplaces: ${error.message}`);
    return { marketplaces: [] };
  }
}

/**
 * Save marketplace configuration
 * @param {Object} config - Marketplaces config
 */
export function saveMarketplaces(config) {
  ensurePluginsDir();
  const dir = path.dirname(MARKETPLACES_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(MARKETPLACES_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/**
 * Add a marketplace
 * @param {string} repoUrl - GitHub repo URL or full URL
 * @returns {Promise<boolean>} Success status
 */
export async function addMarketplace(repoUrl) {
  const config = loadMarketplaces();

  // Normalize the URL
  let normalizedUrl = repoUrl;
  if (!repoUrl.includes('://')) {
    // Assume GitHub shorthand (user/repo)
    normalizedUrl = `https://github.com/${repoUrl}`;
  }

  // Check if already added
  if (config.marketplaces.some(m => m.url === normalizedUrl)) {
    console.warn(`Marketplace ${normalizedUrl} already added`);
    return false;
  }

  // Add the marketplace
  config.marketplaces.push({
    url: normalizedUrl,
    addedAt: new Date().toISOString()
  });

  saveMarketplaces(config);
  console.info(`Added marketplace: ${normalizedUrl}`);
  return true;
}

/**
 * Remove a marketplace
 * @param {string} repoUrl - GitHub repo URL or shorthand
 * @returns {boolean} Success status
 */
export function removeMarketplace(repoUrl) {
  const config = loadMarketplaces();

  // Normalize the URL
  let normalizedUrl = repoUrl;
  if (!repoUrl.includes('://')) {
    normalizedUrl = `https://github.com/${repoUrl}`;
  }

  const originalLength = config.marketplaces.length;
  config.marketplaces = config.marketplaces.filter(m => m.url !== normalizedUrl);

  if (config.marketplaces.length === originalLength) {
    console.warn(`Marketplace ${normalizedUrl} not found`);
    return false;
  }

  saveMarketplaces(config);
  console.info(`Removed marketplace: ${normalizedUrl}`);
  return true;
}

/**
 * List all configured marketplaces
 * @returns {Object[]} Array of marketplace objects
 */
export function listMarketplaces() {
  const config = loadMarketplaces();
  return config.marketplaces;
}

/**
 * Fetch marketplace.json from a repository
 * @param {string} repoUrl - Repository URL
 * @returns {Promise<Object|null>} Marketplace manifest or null
 */
export async function fetchMarketplaceManifest(repoUrl) {
  try {
    // Convert GitHub URL to raw content URL
    let rawUrl = repoUrl;
    if (repoUrl.includes('github.com')) {
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (match) {
        rawUrl = `https://raw.githubusercontent.com/${match[1]}/${match[2]}/main/.claude-plugin/marketplace.json`;
      }
    }

    // Use curl to fetch (more reliable cross-platform)
    const { stdout } = await execFilePromise('curl', ['-sL', rawUrl], { timeout: 10000 });
    return JSON.parse(stdout);
  } catch (error) {
    console.error(`Error fetching marketplace manifest: ${error.message}`);
    return null;
  }
}

/**
 * Install a plugin from a marketplace
 * @param {string} pluginName - Name of the plugin
 * @param {string} marketplaceUrl - Marketplace URL
 * @returns {Promise<boolean>} Success status
 */
export async function installPlugin(pluginName, marketplaceUrl) {
  try {
    ensurePluginsDir();

    const manifest = await fetchMarketplaceManifest(marketplaceUrl);
    if (!manifest) {
      console.error('Could not fetch marketplace manifest');
      return false;
    }

    const plugin = manifest.plugins?.find(p => p.name === pluginName);
    if (!plugin) {
      console.error(`Plugin ${pluginName} not found in marketplace`);
      return false;
    }

    // Clone the plugin (simplified - assumes GitHub)
    const match = marketplaceUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      console.error('Only GitHub repositories are currently supported');
      return false;
    }

    const pluginDir = path.join(PLUGINS_DIR, pluginName);

    // If plugin.source is a relative path, construct full URL
    let sourceUrl;
    if (plugin.source.startsWith('./') || plugin.source.startsWith('../')) {
      sourceUrl = `https://github.com/${match[1]}/${match[2]}/tree/main/${plugin.source.replace('./', '')}`;
    } else if (plugin.source.includes('://')) {
      sourceUrl = plugin.source;
    } else {
      sourceUrl = `https://github.com/${match[1]}/${match[2]}/tree/main/${plugin.source}`;
    }

    console.info(`Installing ${pluginName} from ${sourceUrl}...`);

    // For now, we'll use git sparse-checkout or a simple download
    // This is a simplified implementation
    console.info(`Plugin ${pluginName} installation requires manual cloning to ${pluginDir}`);
    console.info(`Clone command: git clone --depth 1 https://github.com/${match[1]}/${match[2]} && mv ${match[2]}/${plugin.source.replace('./', '')} ${pluginDir}`);

    return true;
  } catch (error) {
    console.error(`Error installing plugin: ${error.message}`);
    return false;
  }
}

/**
 * Uninstall a plugin
 * @param {string} pluginName - Name of the plugin
 * @returns {boolean} Success status
 */
export function uninstallPlugin(pluginName) {
  const pluginDir = path.join(PLUGINS_DIR, pluginName);

  if (!fs.existsSync(pluginDir)) {
    console.error(`Plugin ${pluginName} not found`);
    return false;
  }

  try {
    fs.rmSync(pluginDir, { recursive: true, force: true });
    console.info(`Uninstalled plugin: ${pluginName}`);
    return true;
  } catch (error) {
    console.error(`Error uninstalling plugin: ${error.message}`);
    return false;
  }
}

/**
 * List all installed plugins
 * @returns {Object[]} Array of plugin metadata
 */
export function listPlugins() {
  return discoverPlugins().map(p => ({
    name: p.name,
    version: p.version,
    description: p.description,
    hasCommands: p.hasCommands,
    hasAgents: p.hasAgents,
    hasSkills: p.hasSkills,
    hasHooks: p.hasHooks,
    hasMcp: p.hasMcp
  }));
}

/**
 * Get the default plugins directory path
 * @returns {string}
 */
export function getPluginsDir() {
  return PLUGINS_DIR;
}
