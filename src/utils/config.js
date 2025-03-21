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
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
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
 * Get all server groups from the configuration
 * @returns {Object} Object with group names as keys and arrays of server names as values
 */
export function getGroups() {
  const config = readConfig();
  return config.groups || {};
}

/**
 * Add or update a server group
 * @param {string} name - Group name
 * @param {string[]} servers - List of server names in the group
 * @returns {boolean} Success status
 */
export function addGroup(name, servers) {
  const config = readConfig();
  
  // Initialize groups if it doesn't exist
  if (!config.groups) {
    config.groups = {};
  }
  
  // Add/update the group
  config.groups[name] = servers;
  
  return writeConfig(config);
}

/**
 * Remove a server group
 * @param {string} name - Group name to remove
 * @returns {boolean} Success status
 */
export function removeGroup(name) {
  const config = readConfig();
  
  if (!config.groups || !config.groups[name]) {
    return false;
  }
  
  delete config.groups[name];
  return writeConfig(config);
}

/**
 * Expand a server name or group name to list of server names
 * @param {string} name - Server or group name
 * @returns {string[]} List of server names
 */
export function expandServerOrGroup(name) {
  const groups = getGroups();
  
  // If it's a group, return its servers
  if (groups[name]) {
    return groups[name];
  }
  
  // Otherwise, assume it's a server name
  return [name];
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
