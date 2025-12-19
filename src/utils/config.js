import fs from 'fs';
import path from 'path';
import os from 'os';

// Default config paths - using an object to allow properties to be changed for tests
const CONFIG = {
  DIR: path.join(os.homedir(), '.mcpz'),
  PATH: path.join(os.homedir(), '.mcpz', 'config.json'),
  CUSTOM_LOAD_PATH: null,
  CUSTOM_SAVE_PATH: null
};

/**
 * Security: Check if file has insecure permissions
 * @param {string} filePath - Path to check
 * @returns {{secure: boolean, reason?: string}}
 */
function checkFilePermissions(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { secure: true }; // File doesn't exist yet, will be created securely
    }

    const stats = fs.statSync(filePath);

    // Check if file is world-writable (mode & 0o002)
    // On Unix: 0o002 is world-write bit
    if (process.platform !== 'win32') {
      if (stats.mode & 0o002) {
        return { secure: false, reason: 'Config file is world-writable' };
      }
      // Check if file is group-writable (mode & 0o020)
      if (stats.mode & 0o020) {
        return { secure: false, reason: 'Config file is group-writable' };
      }
    }

    return { secure: true };
  } catch (error) {
    // If we can't check permissions, assume it's okay but log warning
    console.warn(`Warning: Could not check permissions for ${filePath}`);
    return { secure: true };
  }
}

/**
 * Ensure config directory exists
 * @param {string} dirPath - The config directory path
 */
function ensureConfigDir(dirPath = CONFIG.DIR) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Set a custom path for loading configuration
 * @param {string} loadPath - The custom path to load config from
 */
export function setCustomLoadPath(loadPath) {
  if (loadPath) {
    CONFIG.CUSTOM_LOAD_PATH = loadPath;
    console.log(`Set custom config load path: ${loadPath}`);
  } else {
    CONFIG.CUSTOM_LOAD_PATH = null;
    console.log('Using default config load path');
  }
}

/**
 * Set a custom path for saving configuration
 * @param {string} savePath - The custom path to save config to
 */
export function setCustomSavePath(savePath) {
  if (savePath) {
    CONFIG.CUSTOM_SAVE_PATH = savePath;
    const saveDir = path.dirname(savePath);
    ensureConfigDir(saveDir);
    console.log(`Set custom config save path: ${savePath}`);
  } else {
    CONFIG.CUSTOM_SAVE_PATH = null;
    console.log('Using default config save path');
  }
}

/**
 * Read config file
 * @returns {Object} The configuration object
 */
export function readConfig() {
  const configPath = CONFIG.CUSTOM_LOAD_PATH || CONFIG.PATH;

  // Ensure directory exists (only for default path)
  if (!CONFIG.CUSTOM_LOAD_PATH) {
    ensureConfigDir();
  }

  if (!fs.existsSync(configPath)) {
    return { servers: [] };
  }

  // Security: Check file permissions before reading
  const permCheck = checkFilePermissions(configPath);
  if (!permCheck.secure) {
    console.error(`Security warning: ${permCheck.reason}`);
    console.error('Please fix permissions with: chmod 600 ' + configPath);
    // Still read but warn - don't block CLI usage
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error(`Error reading config from ${configPath}: ${error.message}`);
    return { servers: [] };
  }
}

/**
 * Write config file
 * @param {Object} config - The configuration object to write
 * @returns {boolean} Whether the write was successful
 */
export function writeConfig(config) {
  const configPath = CONFIG.CUSTOM_SAVE_PATH || CONFIG.PATH;
  
  // Ensure directory exists
  if (!CONFIG.CUSTOM_SAVE_PATH) {
    ensureConfigDir();
  } else {
    ensureConfigDir(path.dirname(configPath));
  }
  
  try {
    // Security: Write with restrictive permissions (owner read/write only)
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    return true;
  } catch (error) {
    console.error(`Error writing config to ${configPath}: ${error.message}`);
    return false;
  }
}

/**
 * Get a server by name
 * @param {string} name - The name of the server
 * @returns {Object|null} The server object or null if not found
 */
export function getServerByName(name) {
  const config = readConfig();
  return config.servers.find(server => server.name === name) || null;
}

/**
 * Add a server to the configuration
 * @param {Object} server - The server object to add
 * @returns {boolean} Whether the add was successful
 */
export function addServer(server) {
  const config = readConfig();
  
  // Check if server with same name already exists
  const existingIndex = config.servers.findIndex(s => s.name === server.name);
  
  if (existingIndex >= 0) {
    // Replace existing server
    config.servers[existingIndex] = server;
  } else {
    // Add new server
    config.servers.push(server);
  }
  
  return writeConfig(config);
}

/**
 * Remove a server from the configuration
 * @param {string} name - The name of the server to remove
 * @returns {boolean} Whether the remove was successful
 */
export function removeServer(name) {
  const config = readConfig();
  
  // Filter out the server with the given name
  const originalLength = config.servers.length;
  config.servers = config.servers.filter(server => server.name !== name);
  
  // If no servers were removed, return false
  if (config.servers.length === originalLength) {
    return false;
  }
  
  return writeConfig(config);
}

/**
 * Migrate config from old 'groups' to new 'toolboxes' format
 * @param {Object} config - The config object to migrate
 * @returns {{config: Object, migrated: boolean}} Migrated config and whether migration occurred
 */
function migrateGroupsToToolboxes(config) {
  if (config.groups && !config.toolboxes) {
    // Migrate groups → toolboxes
    config.toolboxes = config.groups;
    delete config.groups;
    return { config, migrated: true };
  }
  return { config, migrated: false };
}

/**
 * Read config with automatic migration from groups → toolboxes
 * @returns {Object} The configuration object (migrated if needed)
 */
function readConfigWithMigration() {
  const config = readConfig();
  const { config: migratedConfig, migrated } = migrateGroupsToToolboxes(config);

  if (migrated) {
    // Auto-save the migrated config
    writeConfig(migratedConfig);
    console.info('\x1b[33m[mcpz] Config migrated: "groups" → "toolboxes"\x1b[0m');
  }

  return migratedConfig;
}

/**
 * Get all server toolboxes from the configuration
 * @returns {Object} Object with toolbox names as keys and arrays of server names as values
 */
export function getToolboxes() {
  const config = readConfigWithMigration();
  return config.toolboxes || {};
}

/**
 * Add or update a server toolbox
 * @param {string} name - Toolbox name
 * @param {string[]} servers - List of server names in the toolbox
 * @returns {boolean} Success status
 */
export function addToolbox(name, servers) {
  const config = readConfigWithMigration();

  // Initialize toolboxes if it doesn't exist
  if (!config.toolboxes) {
    config.toolboxes = {};
  }

  // Add/update the toolbox
  config.toolboxes[name] = servers;

  return writeConfig(config);
}

/**
 * Remove a server toolbox
 * @param {string} name - Toolbox name to remove
 * @returns {boolean} Success status
 */
export function removeToolbox(name) {
  const config = readConfigWithMigration();

  if (!config.toolboxes || !config.toolboxes[name]) {
    return false;
  }

  delete config.toolboxes[name];
  return writeConfig(config);
}

/**
 * Expand a server name or toolbox name to list of server names
 * @param {string} name - Server or toolbox name
 * @returns {string[]} List of server names
 */
export function expandServerOrToolbox(name) {
  const toolboxes = getToolboxes();

  // If it's a toolbox, return its servers
  if (toolboxes[name]) {
    return toolboxes[name];
  }

  // Otherwise, assume it's a server name
  return [name];
}

// ============================================================================
// DEPRECATED: Legacy 'groups' API - use 'toolboxes' instead
// These functions provide backwards compatibility but will show warnings
// ============================================================================

let groupsDeprecationWarned = false;

/**
 * Show deprecation warning for groups API (once per session)
 */
function warnGroupsDeprecation() {
  if (!groupsDeprecationWarned) {
    console.warn('\x1b[33m[mcpz] Warning: "groups" is deprecated, please use "toolbox" instead\x1b[0m');
    console.warn('\x1b[33m[mcpz] Run: mcpz toolbox list\x1b[0m');
    groupsDeprecationWarned = true;
  }
}

/**
 * @deprecated Use getToolboxes() instead
 */
export function getGroups() {
  warnGroupsDeprecation();
  return getToolboxes();
}

/**
 * @deprecated Use addToolbox() instead
 */
export function addGroup(name, servers) {
  warnGroupsDeprecation();
  return addToolbox(name, servers);
}

/**
 * @deprecated Use removeToolbox() instead
 */
export function removeGroup(name) {
  warnGroupsDeprecation();
  return removeToolbox(name);
}

/**
 * @deprecated Use expandServerOrToolbox() instead
 */
export function expandServerOrGroup(name) {
  warnGroupsDeprecation();
  return expandServerOrToolbox(name);
}

/**
 * Determine if logging should be enabled based on context
 * and environment settings
 * 
 * Follows these rules:
 * - In TTY mode (interactive terminal), be more verbose by default
 * - In piped mode (non-TTY), only log if debug mode is explicitly enabled
 * - Error logging is always enabled regardless of this setting
 * 
 * @returns {boolean} Whether logging should be enabled
 */
function isLogging() {
  // Check if we're in a piped context (not a TTY)
  const isPiped = !process.stdout.isTTY;
  
  // Check if debug mode is enabled via environment variable or command line
  const isDebugMode = process.env.DEBUG === 'true' || 
                      process.argv.includes('--debug');
  
  // In piped context, we should only log if explicitly requested via debug mode
  // In TTY (interactive) context, we can be more verbose
  return isPiped ? isDebugMode : true;
}

export { isLogging, CONFIG };
