# Implementation Guide - Code Examples & Patterns

This document provides specific code examples for implementing the architectural recommendations.

---

## 1. SDK Adapter Pattern

### File: `/src/utils/sdkAdapter.js`

```javascript
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

/**
 * SDK Adapter - Abstracts version-specific SDK code
 * Allows testing and upgrading SDK without refactoring server.js
 */

// Get package version at runtime
function getPackageVersion(packageName) {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const packageJsonPath = path.resolve(__dirname, '../../node_modules', packageName, 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    return packageJson.version
  } catch {
    return 'unknown'
  }
}

const SDK_VERSION = getPackageVersion('@modelcontextprotocol/sdk')

/**
 * Create an MCP Server instance (abstracted from SDK version)
 * @param {string} name - Server name
 * @param {string} version - Server version
 * @returns {Promise<Object>} MCP Server instance
 */
export async function createMcpServer(name, version) {
  const { Server } = await import('@modelcontextprotocol/sdk/server/index.js')

  return new Server({
    name,
    version,
    capabilities: {
      tools: {},
      resources: {}
    }
  })
}

/**
 * Create stdio transport (abstracted)
 * @returns {Promise<Object>} StdioServerTransport instance
 */
export async function createStdioTransport() {
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js')
  return new StdioServerTransport()
}

/**
 * Create a tool schema in the current SDK version format
 * @param {Object} toolDef - Tool definition
 * @returns {Object} Tool schema compatible with current SDK
 */
export function createToolSchema(toolDef) {
  // Handle both draft-07 (1.12.0) and draft-2020-12 (1.25.1) formats
  if (toolDef.$schema) {
    return toolDef // Already formatted
  }

  // Default schema format (adjust based on SDK version)
  return {
    type: 'object',
    properties: toolDef.properties || {},
    required: toolDef.required || [],
    ...toolDef
  }
}

/**
 * Convert tool schema between SDK versions
 * @param {Object} tool - Tool with input_schema
 * @param {string} sourceVersion - Source SDK version (e.g., '1.12.0')
 * @param {string} targetVersion - Target SDK version (e.g., '1.25.1')
 * @returns {Object} Converted tool
 */
export function convertToolSchema(tool, sourceVersion, targetVersion) {
  const converted = { ...tool }

  // Convert from draft-07 to draft-2020-12 if needed
  if (sourceVersion.startsWith('1.') && parseInt(sourceVersion.split('.')[1]) < 25) {
    if (targetVersion.startsWith('1.') && parseInt(targetVersion.split('.')[1]) >= 25) {
      converted.inputSchema = migrateSchemaFormat(tool.inputSchema)
    }
  }

  return converted
}

/**
 * Migrate JSON schema from draft-07 to draft-2020-12
 * @param {Object} schema - Draft-07 schema
 * @returns {Object} Draft-2020-12 schema
 */
function migrateSchemaFormat(schema) {
  if (!schema) return schema

  // Add $schema if not present
  const migrated = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    ...schema
  }

  // Remove draft-07 specific properties if any
  // This is a placeholder - actual migration depends on schema content
  delete migrated['$comment'] // example

  return migrated
}

/**
 * Get error code enum (may change between SDK versions)
 * @returns {Object} ErrorCode enum
 */
export async function getErrorCodeEnum() {
  const { ErrorCode } = await import('@modelcontextprotocol/sdk/types.js')
  return ErrorCode
}

/**
 * Create an MCP error instance
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @returns {Object} McpError instance
 */
export async function createMcpError(code, message) {
  const { McpError } = await import('@modelcontextprotocol/sdk/types.js')
  return new McpError(code, message)
}

/**
 * Get SDK version for diagnostic/debugging
 */
export function getSdkVersion() {
  return SDK_VERSION
}

/**
 * Check if SDK version is compatible
 * @param {string} requiredVersion - Minimum required version (e.g., '1.12.0')
 * @returns {boolean} True if current version >= required version
 */
export function isSdkVersionCompatible(requiredVersion) {
  const current = SDK_VERSION.split('.').map(Number)
  const required = requiredVersion.split('.').map(Number)

  for (let i = 0; i < 3; i++) {
    if (current[i] > required[i]) return true
    if (current[i] < required[i]) return false
  }

  return true
}

export { SDK_VERSION }
```

### Usage in `server.js`

```javascript
import { createMcpServer, createStdioTransport, getSdkVersion } from './utils/sdkAdapter.js'

// Before (tightly coupled):
// import { Server } from '@modelcontextprotocol/sdk/server/index.js'
// import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

async function setupServer() {
  console.info(`Starting with SDK version: ${getSdkVersion()}`)

  const server = await createMcpServer('mcpz', '1.0.0')
  const transport = await createStdioTransport()

  await server.connect(transport)
}
```

---

## 2. Config Schema & Validation

### File: `/src/utils/configSchema.js`

```javascript
/**
 * Configuration Schema - Define and validate config structure
 * Enables clear documentation and migration paths
 */

/**
 * Schema versions: Increment when config structure changes
 */
export const CONFIG_VERSIONS = {
  '1.0': {
    description: 'Initial schema with servers only',
    from: '1.0.0'
  },
  '1.1': {
    description: 'Added groups support',
    from: '1.1.0'
  },
  '1.2': {
    description: 'Added toolboxes (renamed groups) and plugins',
    from: '1.2.0'
  },
  '1.3': {
    description: 'Added skills support',
    from: '1.3.0'
  }
}

/**
 * JSON Schema for validation
 */
export const CONFIG_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    configVersion: {
      type: 'string',
      enum: Object.keys(CONFIG_VERSIONS),
      description: 'Configuration format version'
    },
    servers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'command'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            description: 'Server name (unique identifier)'
          },
          command: {
            type: 'string',
            minLength: 1,
            description: 'Command to execute'
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Command arguments'
          },
          env: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Environment variables'
          },
          enabled: {
            type: 'boolean',
            default: true,
            description: 'Whether server is enabled'
          }
        }
      },
      description: 'List of MCP servers'
    },
    toolboxes: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: { type: 'string' }
      },
      description: 'Toolboxes (collections of servers)'
    },
    groups: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: { type: 'string' }
      },
      description: 'DEPRECATED: Use toolboxes instead'
    },
    plugins: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          version: { type: 'string' }
        }
      },
      description: 'Installed plugins and their state'
    },
    skills: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          version: { type: 'string' }
        }
      },
      description: 'Installed skills and their state'
    }
  },
  additionalProperties: false
}

/**
 * Validate config against schema
 * @param {Object} config - Configuration object
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateConfig(config) {
  const errors = []

  // Check if servers array exists
  if (!Array.isArray(config.servers)) {
    errors.push('servers must be an array')
  }

  // Check server structure
  if (config.servers) {
    config.servers.forEach((server, idx) => {
      if (!server.name) {
        errors.push(`servers[${idx}]: name is required`)
      }
      if (!server.command) {
        errors.push(`servers[${idx}]: command is required`)
      }
    })
  }

  // Check toolboxes structure
  if (config.toolboxes && typeof config.toolboxes !== 'object') {
    errors.push('toolboxes must be an object')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Normalize config to current version
 * @param {Object} config - Configuration object
 * @returns {Object} Normalized config
 */
export function normalizeConfig(config) {
  const normalized = { ...config }

  // Ensure servers array exists
  if (!normalized.servers) {
    normalized.servers = []
  }

  // Migrate groups → toolboxes if needed
  if (normalized.groups && !normalized.toolboxes) {
    normalized.toolboxes = normalized.groups
    delete normalized.groups
  }

  // Ensure plugin/skill objects exist
  if (!normalized.plugins) {
    normalized.plugins = {}
  }
  if (!normalized.skills) {
    normalized.skills = {}
  }

  // Set current version if not present
  if (!normalized.configVersion) {
    const latestVersion = Object.keys(CONFIG_VERSIONS).sort().pop()
    normalized.configVersion = latestVersion
  }

  return normalized
}

/**
 * Get migration path from old version to current
 * @param {string} fromVersion - Source version
 * @param {string} toVersion - Target version (current)
 * @returns {Array} Array of versions to migrate through
 */
export function getMigrationPath(fromVersion, toVersion) {
  const from = parseVersion(fromVersion)
  const to = parseVersion(toVersion)

  const allVersions = Object.keys(CONFIG_VERSIONS)
    .sort((a, b) => compareVersions(a, b))

  return allVersions.filter(v => {
    const vParsed = parseVersion(v)
    return vParsed.major > from.major ||
           (vParsed.major === from.major && vParsed.minor > from.minor)
  })
}

function parseVersion(version) {
  const [major, minor] = version.split('.').map(Number)
  return { major, minor }
}

function compareVersions(v1, v2) {
  const [maj1, min1] = v1.split('.').map(Number)
  const [maj2, min2] = v2.split('.').map(Number)

  if (maj1 !== maj2) return maj1 - maj2
  return min1 - min2
}
```

### Usage in `config.js`

```javascript
import { validateConfig, normalizeConfig } from './configSchema.js'

export function readConfig() {
  const configPath = CONFIG.CUSTOM_LOAD_PATH || CONFIG.PATH

  if (!fs.existsSync(configPath)) {
    return { servers: [] }
  }

  try {
    let config = JSON.parse(fs.readFileSync(configPath, 'utf8'))

    // Normalize and validate
    config = normalizeConfig(config)
    const validation = validateConfig(config)

    if (!validation.valid) {
      console.error('Config validation errors:')
      validation.errors.forEach(err => console.error(`  - ${err}`))
    }

    return config
  } catch (error) {
    console.error(`Error reading config from ${configPath}: ${error.message}`)
    return { servers: [] }
  }
}
```

---

## 3. Toolbox Manager - Groups Rename

### File: `/src/utils/toolboxManager.js`

```javascript
import chalk from 'chalk'
import { readConfig, writeConfig } from './config.js'

/**
 * Toolbox Manager - Manages server toolboxes (formerly "groups")
 * Provides migration path from old "groups" to new "toolboxes"
 */

export class ToolboxManager {
  /**
   * Get all toolboxes
   * @returns {Object} Object with toolbox names as keys
   */
  static getAll() {
    const config = readConfig()
    return config.toolboxes || {}
  }

  /**
   * Get a specific toolbox
   * @param {string} name - Toolbox name
   * @returns {string[]} Array of server names in toolbox
   */
  static get(name) {
    const toolboxes = this.getAll()
    return toolboxes[name] || []
  }

  /**
   * Create or update a toolbox
   * @param {string} name - Toolbox name
   * @param {string[]} servers - Server names
   * @returns {boolean} Success status
   */
  static add(name, servers) {
    const config = readConfig()

    if (!config.toolboxes) {
      config.toolboxes = {}
    }

    config.toolboxes[name] = servers

    return writeConfig(config)
  }

  /**
   * Delete a toolbox
   * @param {string} name - Toolbox name
   * @returns {boolean} Success status
   */
  static remove(name) {
    const config = readConfig()

    if (!config.toolboxes || !config.toolboxes[name]) {
      return false
    }

    delete config.toolboxes[name]
    return writeConfig(config)
  }

  /**
   * Expand toolbox name to server list
   * @param {string} name - Toolbox or server name
   * @returns {string[]} Array of server names
   */
  static expand(name) {
    const toolbox = this.get(name)
    if (toolbox && toolbox.length > 0) {
      return toolbox
    }
    return [name] // Assume it's a server name
  }

  /**
   * Check if name is a toolbox
   * @param {string} name - Name to check
   * @returns {boolean} True if name is a toolbox
   */
  static isToolbox(name) {
    return name in this.getAll()
  }

  /**
   * Migrate old "groups" config to "toolboxes"
   * Safe to call multiple times (idempotent)
   * @returns {boolean} True if migration was performed
   */
  static migrateGroupsToToolboxes() {
    const config = readConfig()

    if (config.groups && !config.toolboxes) {
      config.toolboxes = config.groups
      delete config.groups

      const success = writeConfig(config)

      if (success) {
        console.info(chalk.green('Configuration migrated: groups → toolboxes'))
      }

      return success
    }

    return false // Already migrated or no groups present
  }

  /**
   * Get migration status
   * @returns {Object} Migration information
   */
  static getMigrationStatus() {
    const config = readConfig()

    return {
      hasGroups: !!config.groups,
      hasToolboxes: !!config.toolboxes,
      needsMigration: config.groups && !config.toolboxes,
      groupCount: Object.keys(config.groups || {}).length,
      toolboxCount: Object.keys(config.toolboxes || {}).length
    }
  }
}

// Backward compatibility aliases
export const getGroups = () => ToolboxManager.getAll()
export const addGroup = (name, servers) => ToolboxManager.add(name, servers)
export const removeGroup = (name) => ToolboxManager.remove(name)
export const expandServerOrGroup = (name) => ToolboxManager.expand(name)
```

### Updated Command: `/src/commands/toolbox.js`

```javascript
import chalk from 'chalk'
import { ToolboxManager } from '../utils/toolboxManager.js'

/**
 * Add a new toolbox
 */
export function addToolbox(name, options) {
  if (!name) {
    console.info(chalk.red('Toolbox name is required'))
    return
  }

  if (!options.servers) {
    console.info(chalk.red('Server list is required (--servers)'))
    return
  }

  const servers = options.servers
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (servers.length === 0) {
    console.info(chalk.red('Server list cannot be empty'))
    return
  }

  const success = ToolboxManager.add(name, servers)

  if (success) {
    console.info(chalk.green(`Toolbox '${name}' created with servers: ${servers.join(', ')}`))
  } else {
    console.info(chalk.red(`Failed to create toolbox '${name}'`))
  }
}

/**
 * Remove a toolbox
 */
export function removeToolbox(name) {
  if (!name) {
    console.info(chalk.red('Toolbox name is required'))
    return
  }

  const success = ToolboxManager.remove(name)

  if (success) {
    console.info(chalk.green(`Toolbox '${name}' removed`))
  } else {
    console.info(chalk.red(`Toolbox '${name}' not found`))
  }
}

/**
 * List all toolboxes
 */
export function listToolboxes() {
  const toolboxes = ToolboxManager.getAll()
  const names = Object.keys(toolboxes)

  if (names.length === 0) {
    console.info(chalk.yellow('No toolboxes defined'))
    return
  }

  console.info(chalk.bold('\nToolboxes:'))

  names.forEach(name => {
    const servers = toolboxes[name]
    console.info(chalk.cyan(`\n${name}:`))

    if (servers && servers.length > 0) {
      servers.forEach(server => {
        console.info(`  - ${server}`)
      })
    } else {
      console.info(chalk.yellow('  No servers in this toolbox'))
    }
  })

  console.info('')
}

/**
 * Show migration status and offer to migrate
 */
export function showMigrationStatus() {
  const status = ToolboxManager.getMigrationStatus()

  if (!status.needsMigration) {
    console.info(chalk.green('No migration needed'))
    return
  }

  console.info(chalk.yellow(`Found ${status.groupCount} legacy groups that can be migrated to toolboxes`))
  console.info('Run: mcpz toolbox migrate')
}

/**
 * Perform migration from groups to toolboxes
 */
export function migrateGroupsToToolboxes() {
  const success = ToolboxManager.migrateGroupsToToolboxes()

  if (success) {
    console.info(chalk.green('Migration complete!'))
  } else {
    console.info(chalk.yellow('No migration needed - already using toolboxes'))
  }
}

// Backward compatibility exports
export const addGroup = addToolbox
export const removeGroup = removeToolbox
export const listGroups = listToolboxes
```

### Updated Command Registration: `/src/index.js`

```javascript
// New primary command
program
  .command('toolbox')
  .description('Manage MCP toolboxes (collections of servers)')
  .addCommand(
    new Command('add')
      .description('Create a new toolbox')
      .argument('<n>', 'Name of the toolbox')
      .option('-s, --servers <servers>', 'Comma-separated list of server names')
      .action((name, options) => {
        import('./commands/toolbox.js').then(({ addToolbox }) => {
          addToolbox(name, options)
        })
      })
  )
  .addCommand(
    new Command('remove')
      .description('Remove a toolbox')
      .argument('<n>', 'Name of the toolbox to remove')
      .action((name) => {
        import('./commands/toolbox.js').then(({ removeToolbox }) => {
          removeToolbox(name)
        })
      })
  )
  .addCommand(
    new Command('list')
      .description('List all toolboxes')
      .action(() => {
        import('./commands/toolbox.js').then(({ listToolboxes }) => {
          listToolboxes()
        })
      })
  )
  .addCommand(
    new Command('migrate')
      .description('Migrate legacy groups to toolboxes')
      .action(() => {
        import('./commands/toolbox.js').then(({ migrateGroupsToToolboxes }) => {
          migrateGroupsToToolboxes()
        })
      })
  )

// Backward-compatible alias (hidden from help)
const groupsCommand = program
  .command('groups')
  .description('(Deprecated: use \'toolbox\' instead) Manage MCP groups')
  .addCommand(
    new Command('add')
      .description('Create a new group')
      .argument('<n>', 'Name of the group')
      .option('-s, --servers <servers>', 'Comma-separated list of server names')
      .action((name, options) => {
        console.info(chalk.yellow('Note: groups are now called toolboxes. Use \'mcpz toolbox\' instead.'))
        import('./commands/toolbox.js').then(({ addToolbox }) => {
          addToolbox(name, options)
        })
      })
  )
  .addCommand(
    new Command('remove')
      .description('Remove a group')
      .argument('<n>', 'Name of the group to remove')
      .action((name) => {
        console.info(chalk.yellow('Note: groups are now called toolboxes. Use \'mcpz toolbox\' instead.'))
        import('./commands/toolbox.js').then(({ removeToolbox }) => {
          removeToolbox(name)
        })
      })
  )
  .addCommand(
    new Command('list')
      .description('List all groups')
      .action(() => {
        console.info(chalk.yellow('Note: groups are now called toolboxes. Use \'mcpz toolbox list\' instead.'))
        import('./commands/toolbox.js').then(({ listToolboxes }) => {
          listToolboxes()
        })
      })
  )

// Hide from help output (Commander.js v13+)
if (groupsCommand.hide) {
  groupsCommand.hide()
}
```

---

## 4. Plugin Manager - Foundation for Extensibility

### File: `/src/utils/pluginManager.js`

```javascript
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

/**
 * Plugin Manager - Discover, load, and manage plugins
 * Plugins are npm packages with 'mcpz-plugin-' prefix
 */

export class PluginManager {
  static #instance

  constructor() {
    this.plugins = new Map()
    this.pluginDir = path.join(os.homedir(), '.mcpz', 'plugins')
    this.#ensurePluginDir()
    this.loadPlugins()
  }

  static getInstance() {
    if (!PluginManager.#instance) {
      PluginManager.#instance = new PluginManager()
    }
    return PluginManager.#instance
  }

  #ensurePluginDir() {
    try {
      if (!fs.existsSync(this.pluginDir)) {
        fs.mkdirSync(this.pluginDir, { recursive: true })
      }
    } catch (error) {
      console.error(`Failed to create plugin directory: ${error.message}`)
    }
  }

  /**
   * Load all available plugins (both npm and local)
   */
  loadPlugins() {
    const npmPlugins = this.#discoverNpmPlugins()
    const localPlugins = this.#discoverLocalPlugins()

    ;[...npmPlugins, ...localPlugins].forEach(plugin => {
      this.plugins.set(plugin.id, plugin)
    })
  }

  /**
   * Discover plugins installed via npm (mcpz-plugin-* packages)
   */
  #discoverNpmPlugins() {
    const plugins = []

    try {
      const nodeModulesPath = this.#findNodeModules()

      if (!nodeModulesPath) {
        console.debug('No node_modules found for npm plugin discovery')
        return plugins
      }

      const entries = fs.readdirSync(nodeModulesPath)

      for (const entry of entries) {
        if (entry.startsWith('mcpz-plugin-')) {
          const pluginPath = path.join(nodeModulesPath, entry)
          const manifest = this.#loadPluginManifest(pluginPath)

          if (manifest) {
            plugins.push({
              id: entry,
              name: manifest.name || entry,
              version: manifest.version || '0.0.0',
              path: pluginPath,
              type: 'npm',
              enabled: true,
              servers: manifest.servers || []
            })
          }
        }
      }
    } catch (error) {
      console.debug(`Error discovering npm plugins: ${error.message}`)
    }

    return plugins
  }

  /**
   * Discover local plugins in ~/.mcpz/plugins
   */
  #discoverLocalPlugins() {
    const plugins = []

    try {
      if (!fs.existsSync(this.pluginDir)) {
        return plugins
      }

      const entries = fs.readdirSync(this.pluginDir)

      for (const entry of entries) {
        const pluginPath = path.join(this.pluginDir, entry)
        const stat = fs.statSync(pluginPath)

        if (stat.isDirectory()) {
          const manifest = this.#loadPluginManifest(pluginPath)

          if (manifest) {
            plugins.push({
              id: entry,
              name: manifest.name || entry,
              version: manifest.version || '0.0.0',
              path: pluginPath,
              type: 'local',
              enabled: manifest.enabled !== false,
              servers: manifest.servers || []
            })
          }
        }
      }
    } catch (error) {
      console.debug(`Error discovering local plugins: ${error.message}`)
    }

    return plugins
  }

  /**
   * Load plugin manifest (package.json or manifest.json)
   */
  #loadPluginManifest(pluginPath) {
    try {
      // Try package.json first
      const packageJsonPath = path.join(pluginPath, 'package.json')
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
        // Check for mcpz plugin config in package.json
        if (pkg.mcpz) {
          return { ...pkg, ...pkg.mcpz }
        }
        return pkg
      }

      // Try manifest.json
      const manifestPath = path.join(pluginPath, 'manifest.json')
      if (fs.existsSync(manifestPath)) {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      }

      return null
    } catch (error) {
      console.debug(`Error loading manifest from ${pluginPath}: ${error.message}`)
      return null
    }
  }

  /**
   * Find node_modules directory (walk up from cwd)
   */
  #findNodeModules() {
    let current = process.cwd()

    for (let i = 0; i < 10; i++) {
      const nodeModulesPath = path.join(current, 'node_modules')

      if (fs.existsSync(nodeModulesPath)) {
        return nodeModulesPath
      }

      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }

    // Check global node_modules
    try {
      const globalPath = execSync('npm root -g', { encoding: 'utf8' }).trim()
      if (fs.existsSync(globalPath)) {
        return globalPath
      }
    } catch {
      // Ignore
    }

    return null
  }

  /**
   * Get all plugins
   */
  getAll() {
    return Array.from(this.plugins.values())
  }

  /**
   * Get enabled plugin servers
   */
  getPluginServers() {
    const servers = []

    for (const plugin of this.plugins.values()) {
      if (plugin.enabled && plugin.servers) {
        servers.push(...plugin.servers)
      }
    }

    return servers
  }

  /**
   * Enable/disable a plugin
   */
  setPluginEnabled(pluginId, enabled) {
    const plugin = this.plugins.get(pluginId)

    if (plugin) {
      plugin.enabled = enabled
      return true
    }

    return false
  }

  /**
   * Install a plugin from npm
   * @param {string} pluginName - Plugin name or npm package
   */
  async installPlugin(pluginName) {
    try {
      const packageName = pluginName.startsWith('mcpz-plugin-')
        ? pluginName
        : `mcpz-plugin-${pluginName}`

      console.info(`Installing plugin: ${packageName}`)

      // Install globally or in project
      execSync(`npm install -g ${packageName}`, { stdio: 'inherit' })

      // Reload plugins
      this.loadPlugins()

      return { success: true, packageName }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId) {
    try {
      const plugin = this.plugins.get(pluginId)

      if (!plugin) {
        return { success: false, error: 'Plugin not found' }
      }

      if (plugin.type === 'npm') {
        execSync(`npm uninstall -g ${plugin.id}`, { stdio: 'inherit' })
      } else if (plugin.type === 'local') {
        // Delete local plugin directory
        fs.rmSync(plugin.path, { recursive: true, force: true })
      }

      this.loadPlugins()

      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}
```

---

## 5. Test Patterns - Testing Each Layer

### File: `/test/toolbox.test.js` (renamed from groups.test.js)

```javascript
import assert from 'node:assert'
import { describe, it, before, after } from 'node:test'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { ToolboxManager } from '../src/utils/toolboxManager.js'
import * as configModule from '../src/utils/config.js'

describe('Toolbox Management', () => {
  const TEST_DIR = path.join(os.tmpdir(), 'mcpz-toolbox-test-' + Date.now())
  const TEST_CONFIG_DIR = path.join(TEST_DIR, '.mcpz')
  const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, 'config.json')

  let originalDir, originalPath

  before(() => {
    // Save original config paths
    originalDir = configModule.CONFIG.DIR
    originalPath = configModule.CONFIG.PATH

    // Override with test paths
    configModule.CONFIG.DIR = TEST_CONFIG_DIR
    configModule.CONFIG.PATH = TEST_CONFIG_PATH

    // Ensure test directory exists
    fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true })
  })

  after(() => {
    // Restore original paths
    configModule.CONFIG.DIR = originalDir
    configModule.CONFIG.PATH = originalPath

    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  describe('Add toolbox', () => {
    it('should create a new toolbox', () => {
      const success = ToolboxManager.add('test-toolbox', ['server1', 'server2'])

      assert.strictEqual(success, true)
      const toolbox = ToolboxManager.get('test-toolbox')
      assert.deepStrictEqual(toolbox, ['server1', 'server2'])
    })

    it('should update existing toolbox', () => {
      ToolboxManager.add('existing', ['server1'])
      const success = ToolboxManager.add('existing', ['server1', 'server2', 'server3'])

      assert.strictEqual(success, true)
      const toolbox = ToolboxManager.get('existing')
      assert.deepStrictEqual(toolbox, ['server1', 'server2', 'server3'])
    })
  })

  describe('Remove toolbox', () => {
    it('should remove existing toolbox', () => {
      ToolboxManager.add('to-remove', ['server1'])
      const success = ToolboxManager.remove('to-remove')

      assert.strictEqual(success, true)
      const toolbox = ToolboxManager.get('to-remove')
      assert.deepStrictEqual(toolbox, [])
    })

    it('should return false if toolbox not found', () => {
      const success = ToolboxManager.remove('nonexistent')
      assert.strictEqual(success, false)
    })
  })

  describe('Expand toolbox name', () => {
    it('should expand toolbox name to server list', () => {
      ToolboxManager.add('python-stack', ['python', 'numpy', 'scipy'])
      const expanded = ToolboxManager.expand('python-stack')

      assert.deepStrictEqual(expanded, ['python', 'numpy', 'scipy'])
    })

    it('should return single server name if not a toolbox', () => {
      const expanded = ToolboxManager.expand('single-server')
      assert.deepStrictEqual(expanded, ['single-server'])
    })
  })

  describe('Migrate groups to toolboxes', () => {
    it('should migrate legacy groups format', () => {
      // Write old-style config
      const config = {
        servers: [],
        groups: {
          'old-group': ['server1', 'server2']
        }
      }
      configModule.writeConfig(config)

      // Perform migration
      const success = ToolboxManager.migrateGroupsToToolboxes()

      assert.strictEqual(success, true)

      // Verify migration
      const toolboxes = ToolboxManager.getAll()
      assert.ok(toolboxes['old-group'])
      assert.deepStrictEqual(toolboxes['old-group'], ['server1', 'server2'])

      // Verify old format is gone
      const readConfig = configModule.readConfig()
      assert.strictEqual(readConfig.groups, undefined)
      assert.ok(readConfig.toolboxes)
    })

    it('should be idempotent', () => {
      const config = {
        servers: [],
        toolboxes: {
          'existing-toolbox': ['server1']
        }
      }
      configModule.writeConfig(config)

      // Migration should return false (nothing to migrate)
      const success = ToolboxManager.migrateGroupsToToolboxes()
      assert.strictEqual(success, false)

      // Config should be unchanged
      const toolboxes = ToolboxManager.getAll()
      assert.deepStrictEqual(toolboxes, { 'existing-toolbox': ['server1'] })
    })
  })
})
```

---

## 6. Integration Example - Combining Features

### Example: Adding a plugin that provides tools

```javascript
// Workflow:
// 1. User installs plugin: mcpz plugins install github
// 2. Plugin registers server in config
// 3. User creates toolbox including that server
// 4. User runs: mcpz run --toolbox github-tools

// In config.json after plugin install:
{
  "servers": [
    {
      "name": "github-api",
      "command": "node",
      "args": ["path/to/github-plugin/server.js"]
    }
  ],
  "toolboxes": {
    "github-tools": ["github-api", "github-search"]
  },
  "plugins": {
    "mcpz-plugin-github": {
      "enabled": true,
      "version": "1.0.0"
    }
  }
}

// Interactive usage:
// $ mcpz interactive
// > /install-plugin github
// > /list-plugins
// > /toolbox add github-tools --servers="github-api"
// > /run --toolbox github-tools
```

---

## Key Implementation Notes

1. **Backward Compatibility**: Always support old format (groups) while encouraging new (toolboxes)
2. **Separation of Concerns**: Each manager handles its domain (config, plugins, skills)
3. **Error Handling**: Graceful degradation when registries are unavailable
4. **Testing**: Use temp directories for isolation, mock external calls
5. **SDK Adapter**: Abstracts version-specific code before upgrading

