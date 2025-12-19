#!/usr/bin/env node
import crypto from 'crypto';

import fs from 'fs/promises';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

// Import the instance manager
import { InstanceManager } from './utils/instanceManager.js';

/**
 * Configuration constants
 */
const CONFIG = {
  dirs: {
    mcpz: path.join(os.homedir(), '.mcpz'),
    tools: path.join(os.homedir(), '.mcpz', 'tools'),
    metrics: path.join(os.homedir(), '.mcpz', 'metrics'),
    instances: path.join(os.homedir(), '.mcpz', 'instances')
  },
  server: {
    name: 'mcpz',
    version: '1.0.0'
  },
  // mcpz.run config path
  mcpSettingsPath: path.join(os.homedir(), '.mcpz', 'config.json')
};

const defaultSettings = {
  servers: []
};

/**
 * Ensure required directories exist
 */
function ensureDirectories() {
  try {
    Object.values(CONFIG.dirs).forEach(dir => {
      mkdirSync(dir, { recursive: true });
    });

    // Ensure settings directory exists
    const settingsDir = path.dirname(CONFIG.mcpSettingsPath);
    mkdirSync(settingsDir, { recursive: true });

    console.info('Setup', 'Directories created successfully');
  } catch (error) {
    console.error('Setup', `Failed to create directories: ${error.message}`);
    process.exit(1);
  }
}

// Get instance manager
const instanceManager = InstanceManager.getInstance();

/**
 * VS Code Settings Manager - Handles reading and writing VS Code settings
 */
class SettingsManager {
  #settingsCache = null;
  #cacheTimestamp = 0;
  #cacheTTL = 5000; // 5 seconds cache TTL (was incorrectly set to 0)

  /**
 * Get the server name for a tool
 * @param {string} toolName - The name of the tool
 * @returns {string} - The server name
 */
  getServerNameForTool(toolName) {
    const servers = this.getServers();

    for (const server of servers) {
      // Skip disabled servers
      if (!server.enabled) continue;

      // Check if tool is allowed or approved
      const isAllowed = this.#isToolInList(toolName, server.alwaysAllow);
      const isApproved = this.#isToolInList(toolName, server.autoApprove);

      if (isAllowed || isApproved) {
        return server.name;
      }
    }

    return null;
  }

  /**
   * Get the current VS Code settings with caching
   * @returns {Object} - The settings object
   */
  getSettings() {
    const now = Date.now();

    // Return cached settings if still valid
    if (this.#settingsCache && (now - this.#cacheTimestamp < this.#cacheTTL)) {
      return this.#settingsCache;
    }

    try {
      if (existsSync(CONFIG.mcpSettingsPath)) {
        const settings = JSON.parse(readFileSync(CONFIG.mcpSettingsPath, 'utf8'));
        this.#settingsCache = settings;
        this.#cacheTimestamp = now;
        return settings;
      }
    } catch (error) {
      console.error('Settings Manager', `Error loading settings: ${error.message}`);
    }

    return defaultSettings;
  }
  
  /**
   * Get the servers array from settings
   * @returns {Array} - Array of server objects
   */
  getServers() {
    const settings = this.getSettings();
    
    // Return the servers array if it exists
    if (settings && settings['servers'] && Array.isArray(settings['servers'])) {
      return settings['servers'];
    }
    
    // Return empty array if no servers are found
    return [];
  }

  /**
   * Save the mcpz.run settings
   * @param {Object} settings - The settings object to save
   * @returns {boolean} - Whether the save was successful
   */
  saveSettings(settings) {
    try {
      writeFileSync(CONFIG.mcpSettingsPath, JSON.stringify(settings, null, 2));
      this.#settingsCache = settings;
      this.#cacheTimestamp = Date.now();
      console.info('Settings Manager', 'Settings saved successfully');
      return true;
    } catch (error) {
      console.error('Settings Manager', `Error saving settings: ${error.message}`);
      return false;
    }
  }

  /**
   * Get the settings for a specific tool
   * @param {string} toolName - The name of the tool
   * @returns {Object} - The tool settings
   */
  getToolSettings(toolName) {
    const servers = this.getServers();
    
    for (const server of servers) {
      const isAllowed = this.#isToolInList(toolName, server.alwaysAllow);
      const isApproved = this.#isToolInList(toolName, server.autoApprove);
      
      if (isAllowed || isApproved) {
        return {
          serverName: server.name,
          isAllowed,
          isApproved,
        };
      }
    }
    
    return {
      serverName: null,
      isAllowed: false,
      isApproved: false,
      isDisabled: false
    };
  }

  /**
   * Update the settings for a specific tool
   * @param {string} toolName - The name of the tool
   * @param {Object} settings - The settings to update
   * @returns {boolean} - Whether the update was successful
   */
  updateToolSettings(toolName, settings) {
    const mcpSettings = this.getSettings();
    const servers = mcpSettings['mcpz.servers'] || [];
    
    // If no server is specified, use the first one or create a new one
    let serverName = settings.serverName;
    let serverIndex = -1;
    
    if (!serverName) {
      serverName = servers.length > 0 ? servers[0].name : 'default';
    }
    
    // Find the server by name
    serverIndex = servers.findIndex(s => s.name === serverName);
    
    // Create the server if it doesn't exist
    if (serverIndex === -1) {
      const newServer = {
        id: crypto.randomUUID(),
        name: serverName,
        command: 'node',
        args: [],
        enabled: true,
        type: 'process',
        alwaysAllow: [],
        autoApprove: []
      };
      
      servers.push(newServer);
      serverIndex = servers.length - 1;
    }
    
    const server = servers[serverIndex];
    
    // Update tool lists
    this.#updateToolList(server, 'alwaysAllow', toolName, settings.isAllowed);
    this.#updateToolList(server, 'autoApprove', toolName, settings.isApproved);
    
    // Update disabled
    if (settings.isDisabled !== undefined) {
      server.enabled = !settings.isDisabled;
    }
    
    // Save the updated settings 
    return this.saveSettings(mcpSettings);
  }

  /**
   * Get all allowed tools
   * @returns {string[]} - Array of allowed tool names
   */
  getAllowedTools() {
    const servers = this.getServers();
    const allowedTools = new Set();
    
    for (const server of servers) {
      if (!server.enabled) continue;
      
      if (this.#listContainsWildcard(server.alwaysAllow)) {
        return ['*']; // Special case for wildcard 
      }

      // Add each allowed tool
      if (Array.isArray(server.alwaysAllow)) {
        server.alwaysAllow.forEach(tool => allowedTools.add(tool));
      }
    }
    
    return Array.from(allowedTools);
  }

  /**
   * Get all approved tools
   * @returns {string[]} - Array of approved tool names
   */
  getApprovedTools() {
    const servers = this.getServers();
    const approvedTools = new Set();
    
    for (const server of servers) {
      if (!server.enabled) continue;
      
      if (this.#listContainsWildcard(server.autoApprove)) {
        return ['*']; // Special case for wildcard
      }

      // Add each approved tool
      if (Array.isArray(server.autoApprove)) {
        server.autoApprove.forEach(tool => approvedTools.add(tool));
      }
    }
    
    return Array.from(approvedTools);
  }

  /**
   * Get all favorite tools (both allowed and approved)
   * @returns {string[]} - Array of favorite tool names
   */
  getFavoriteTools() {
    const servers = this.getServers();
    const favoriteTools = new Set();
    
    for (const server of servers) {
      if (!server.enabled) continue;
      
      // Add non-wildcard tools from both lists
      this.#addNonWildcardTools(server.alwaysAllow, favoriteTools);
      this.#addNonWildcardTools(server.autoApprove, favoriteTools);
    }

    return Array.from(favoriteTools);
  }

  /**
   * Check if a tool is in a list (including wildcard)
   * @private
   * @param {string} toolName - The tool name to check
   * @param {string[]} list - The list to check in
   * @returns {boolean} - Whether the tool is in the list
   */
  #isToolInList(toolName, list) {
    if (!Array.isArray(list)) return false;
    return list.includes(toolName) || list.includes('*');
  }

  /**
   * Check if a list contains a wildcard
   * @private
   * @param {string[]} list - The list to check
   * @returns {boolean} - Whether the list contains a wildcard
   */
  #listContainsWildcard(list) {
    return Array.isArray(list) && list.includes('*');
  }

  /**
   * Add non-wildcard tools to a set
   * @private
   * @param {string[]} toolList - The list of tools
   * @param {Set} targetSet - The set to add to
   */
  #addNonWildcardTools(toolList, targetSet) {
    if (!Array.isArray(toolList)) return;

    toolList.forEach(tool => {
      if (tool !== '*') {
        targetSet.add(tool);
      }
    });
  }

  /**
   * Update a tool list (alwaysAllow or autoApprove)
   * @private
   * @param {Object} server - The server object
   * @param {string} listName - The name of the list to update
   * @param {string} toolName - The tool name
   * @param {boolean} value - Whether to add or remove the tool
   */
  #updateToolList(server, listName, toolName, value) {
    if (value === undefined) return;

    if (!server[listName]) {
      server[listName] = [];
    }
    
    if (value) {
      // Add the tool if it's not already there and not covered by wildcard
      if (!server[listName].includes(toolName) && !server[listName].includes('*')) {
        server[listName].push(toolName);
      }
    } else {
      // Remove the tool
      server[listName] = server[listName].filter(t => t !== toolName);
    }
  }
}

/**
 * Tool Registry - Manages tool definitions and operations
 */
class ToolRegistry {
  #tools = {};

  /**
   * Clear all tools from the registry and filesystem
   * @returns {Promise<void>}
   */
  async clearTools() {
    try {
      // Clear in-memory tools
      this.#tools = {};
      
      // Clear tools from filesystem
      if (existsSync(CONFIG.dirs.tools)) {
        const files = await fs.readdir(CONFIG.dirs.tools);
        for (const file of files) {
          if (file.endsWith('.json')) {
            await fs.unlink(path.join(CONFIG.dirs.tools, file));
          }
        }
      }
      console.info('Tool Registry', 'Cleared all tools from registry and filesystem');
    } catch (error) {
      console.error('Tool Registry', `Error clearing tools: ${error.message}`);
    }
  }

  /**
   * Load tools from storage
   * @returns {Promise<void>}
   */
  async load() {
    try {
      const files = await fs.readdir(CONFIG.dirs.tools);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(CONFIG.dirs.tools, file);
          const data = await fs.readFile(filePath, 'utf8');
          const toolData = JSON.parse(data);
          this.#tools[toolData.name] = toolData;
        }
      }

      console.info('Tool Registry', `Loaded ${Object.keys(this.#tools).length} tools`);
    } catch (error) {
      console.error('Tool Registry', `Error loading tools: ${error.message}`);
    }
    
    // Add built-in tools if they don't exist
    this.ensureBuiltInTools();
  }

  /**
   * Save a tool to storage
   * @param {Object} tool - The tool to save
   * @returns {Promise<boolean>} - Whether the save was successful
   */
  async save(tool) {
    if (!tool || !tool.name) {
      console.error('Tool Registry', 'Cannot save tool: missing name');
      return false;
    }

    try {
      this.#tools[tool.name] = tool;

      const filePath = path.join(CONFIG.dirs.tools, `${tool.name}.json`);
      await fs.writeFile(filePath, JSON.stringify(tool, null, 2));

      console.info('Tool Registry', `Saved tool: ${tool.name}`);
      return true;
    } catch (error) {
      console.error('Tool Registry', `Error saving tool: ${error.message}`);
      return false;
    }
  }

  /**
   * Get a tool by name
   * @param {string} name - The name of the tool
   * @returns {Object|null} - The tool object or null if not found
   */
  get(name) {
    return this.#tools[name] || null;
  }

  /**
   * Find tools matching criteria
   * @param {Object} criteria - The search criteria
   * @returns {Object[]} - Array of matching tools
   */
  find(criteria) {
    if (!criteria) return [];

    return Object.values(this.#tools).filter(tool => {
      return (
        // Match by name
        (criteria.name && tool.name && tool.name.includes(criteria.name)) ||
        // Match by description
        (criteria.description && tool.description &&
          tool.description.includes(criteria.description)) ||
        // Match by tags
        (criteria.tags && tool.tags &&
          criteria.tags.some(tag => tool.tags.includes(tag)))
      );
    });
  }

  /**
   * List all tools, optionally filtered
   * @param {Object} filter - Filter options
   * @returns {Object[]} - Array of tools
   */
  list(filter = {}) {
    let tools = Object.values(this.#tools);
    
    // Apply filters
    if (filter.tags && Array.isArray(filter.tags)) {
      tools = tools.filter(tool => 
        tool.tags && filter.tags.some(tag => tool.tags.includes(tag))
      );
    }
    
    // Apply sorting
    if (filter.sort) {
      if (filter.sort === 'name') {
        tools.sort((a, b) => a.name.localeCompare(b.name));
      } else if (filter.sort === 'usage' && filter.usageData) {
        // Sort by usage count if usage data is provided
        tools.sort((a, b) => {
          const aCount = filter.usageData[a.name]?.usageCount || 0;
          const bCount = filter.usageData[b.name]?.usageCount || 0;
          return bCount - aCount;
        });
      }
    }
    
    return tools;
  }

  /**
   * Get tools by names
   * @param {string[]} names - Array of tool names
   * @returns {Object[]} - Array of tool objects
   */
  getByNames(names) {
    if (!Array.isArray(names)) {
      return [];
    }

    if (names.includes('*')) {
      return Object.values(this.#tools);
    }
    
    return names
      .map(name => this.get(name))
      .filter(Boolean);
  }

  /**
   * Add server name prefix to tool name
   * @param {Object} tool - The tool object
   * @param {string} serverName - The server name
   * @returns {Object} - The tool with server prefix
   */
  addServerPrefix(tool, serverName) {
    if (!tool || !serverName) {
      console.error('Tool Registry', 'Cannot add server prefix: missing tool or server name');
      return tool;
    }

    return {
      ...tool,
      originalName: tool.name,
      name: `${serverName}_${tool.name}`
    };
  }

  /**
   * Add server name prefix to multiple tools
   * @param {Object[]} tools - Array of tool objects
   * @param {string} serverName - The server name
   * @returns {Object[]} - Array of tools with server prefix
   */
  addServerPrefixToTools(tools, serverName) {
    if (!Array.isArray(tools) || !serverName) {
      console.error('Tool Registry', 'Cannot add server prefix: invalid tools array or missing server name');
      return tools;
    }

    return tools.map(tool => this.addServerPrefix(tool, serverName));
  }

  /**
   * Ensure built-in tools exist
   */
  ensureBuiltInTools() {
    // Add some built-in tools
    const builtInTools = [

    ];

    // Add each built-in tool if it doesn't exist
    for (const tool of builtInTools) {
      if (!this.#tools[tool.name]) {
        this.#tools[tool.name] = tool;
        console.debug('Tool Registry', `Added built-in tool: ${tool.name}`);
      }
    }

    console.debug('Tool Registry', `Ensured ${builtInTools.length} built-in tools`);
  }
}

/**
 * Metrics Manager - Tracks tool usage statistics
 */
class MetricsManager {
  #metricsCache = {};

  /**
   * Track tool usage
   * @param {string} toolName - The name of the tool
   * @returns {Promise<void>}
   */
  async trackUsage(toolName) {
    if (!toolName) {
      console.error('Metrics Manager', 'Cannot track usage: missing tool name');
      return;
    }

    const metricsFile = path.join(CONFIG.dirs.metrics, `${toolName}.json`);
    let metrics = { usageCount: 0, lastUsed: null, history: [] };
    
    // Load existing metrics if available
    if (existsSync(metricsFile)) {
      try {
        metrics = JSON.parse(readFileSync(metricsFile, 'utf8'));
      } catch (error) {
        console.error('Metrics Manager', `Error loading metrics for ${toolName}: ${error.message}`);
      }
    }
    
    // Update metrics
    metrics.usageCount += 1;
    metrics.lastUsed = new Date().toISOString();

    // Add usage with timestamp
    const usage = { timestamp: metrics.lastUsed };
    metrics.history.push(usage);
    
    // Keep history limited to last 100 usages
    if (metrics.history.length > 100) {
      metrics.history = metrics.history.slice(-100);
    }
    
    // Update cache
    this.#metricsCache[toolName] = metrics;

    // Save updated metrics
    try {
      await fs.writeFile(metricsFile, JSON.stringify(metrics, null, 2));
      console.debug('Metrics Manager', `Updated metrics for ${toolName}`);
    } catch (error) {
      console.error('Metrics Manager', `Error saving metrics for ${toolName}: ${error.message}`);
    }
  }

  /**
   * Get all metrics
   * @returns {Promise<Object>} - Object with tool names as keys and metrics as values
   */
  async getAllMetrics() {
    try {
      const files = await fs.readdir(CONFIG.dirs.metrics);
      const metrics = {};

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(CONFIG.dirs.metrics, file);
          const data = await fs.readFile(filePath, 'utf8');
          const toolName = file.replace('.json', '');
          metrics[toolName] = JSON.parse(data);
        }
      }

      return metrics;
    } catch (error) {
      console.error('Metrics Manager', `Error getting metrics: ${error.message}`);
      return {};
    }
  }
}


/**
 * Tool Handler - Handles tool operations
 */
class ToolHandler {
  #toolRegistry;
  #settingsManager;
  #metricsManager;

  constructor(toolRegistry, settingsManager, metricsManager) {
    this.#toolRegistry = toolRegistry;
    this.#settingsManager = settingsManager;
    this.#metricsManager = metricsManager;
  }

  /**
   * Create a success response
   * @private
   * @param {string} text - The response text
   * @returns {Object} - The response object
   */
  createSuccessResponse(text) {
    return {
      content: [
        {
          type: 'text',
          text
        }
      ],
      isError: false
    };
  }

  /**
   * Create an error response
   * @private
   * @param {string} text - The error text
   * @returns {Object} - The response object
   */
  createErrorResponse(text) {
    return {
      content: [
        {
          type: 'text',
          text
        }
      ],
      isError: true
    };
  }
}

/**
 * MCP Server - Main server implementation
 */
class McpServer {
  #server;
  #toolRegistry;
  #settingsManager;
  #metricsManager;
  #toolHandler;
  #mcpClients = new Map();
  #serverFilters = null;
  #toolFilters = null;
  #groupFilters = null;
  constructor() {
    // Create instances of managers
    this.#toolRegistry = new ToolRegistry();
    this.#settingsManager = new SettingsManager();
    this.#metricsManager = new MetricsManager();
    this.#toolHandler = new ToolHandler(this.#toolRegistry, this.#settingsManager, this.#metricsManager);

    // Create MCP server
    this.#server = new Server(
      {
        name: CONFIG.server.name,
        version: CONFIG.server.version,
      },
      {
        capabilities: {
          tools: {},
          resources: {
            list: true,
            templates: {
              list: true
            }
          }
        },
      }
    );

    // Set up error handling
    this.#server.onerror = (error) => {
      console.error(error);
    };

    // Set up request handlers
    this.#setupRequestHandlers();
    
    // Set up methods to provide instance status data to the UI
    this.getInstancesStatus = this.#getInstancesStatus.bind(this);
  }

  /**
   * Parse filter options
   * @private
   * @param {string} single - Single filter value
   * @param {string} multiple - Comma-separated multiple filter values
   * @returns {string[]|null} Array of filter values or null if no filters
   */
  #parseFilters(single, multiple) {
    const filters = new Set();
    
    // Add single filter if provided
    if (single) {
      filters.add(single);
    }
    
    // Add multiple filters if provided (comma-separated)
    if (multiple) {
      multiple.split(',').forEach(name => filters.add(name.trim()));
    }
    
    return filters.size > 0 ? Array.from(filters) : null;
  }

  /**
   * Connect to MCP clients defined in settings
   * @private
   */
  async #connectToMcpClients() {
    console.info('Connecting to MCP clients from settings...');
    
    // Get settings
    const servers = this.#settingsManager.getServers();
    
    // Check if there are any MCP servers configured
    if (!servers || servers.length === 0) {
      console.info('No MCP servers configured in settings');
      return;
    }
    
    // Apply server filters if specified
    let filteredServers = servers;
    if (this.#serverFilters) {
      // Filter servers based on server filters
      // Note: Server filters have already been expanded to include servers from groups in the start method
      filteredServers = servers.filter(server => this.#serverFilters.includes(server.name));
      
      console.info(`Filtered to ${filteredServers.length} servers out of ${servers.length} total`);
    } else {
      console.info(`Found ${servers.length} MCP servers in settings`);
    }
    
    // Connect to each enabled MCP server
    for (const server of filteredServers) { 
      // Skip disabled servers 
      if (!server.enabled) {
        console.info(`Skipping disabled server: ${server.name}`);
        continue;
      }
      
      try {
        // Extract command, args, and env from the server configuration
        const { command, args = [], env = {} } = server;
        
        if (!command) {
          console.error(`Missing command for server: ${server.name}`);
          continue;
        }

        console.info(`Connecting to MCP client: ${server.name}`);
        
        // Parse the command string to handle space-separated arguments
        const [cmd, ...cmdArgs] = command.split(' ');
        const allArgs = [...cmdArgs, ...(Array.isArray(args) ? args : [])];
        
        console.info(`Using command: ${cmd}, args: ${allArgs.join(' ') || 'none'}, env: ${JSON.stringify(env || {})}`);
        
        // Skip if the command is trying to run this same script to avoid infinite recursion
        if (cmd === 'mcpz' || (cmd === 'node' && allArgs.some(arg => arg && (arg.includes('mcpz') || arg.includes('server.js'))))) {
          console.info(`Skipping self-reference to mcpz for ${server.name}`);
          continue;
        }
        
        // Create a client
        const client = new Client({
          name: 'simple-stdio-client',
          version: '1.0.0'
        }, {
          capabilities: {
            tools: true
          }
        });
        
        // Create the appropriate transport based on the server configuration
        const transport = new StdioClientTransport({
          command: cmd,
          args: allArgs,
          env: { ...process.env, ...(env || {}) },
          cwd: process.cwd(),
          stderr: 'pipe'
        });
        
        // Set up event handlers for the transport
        transport.onclose = () => {
          console.info(`Transport closed for ${server.name}`);
          
          // Find the instance ID for this transport process and update its status
          const instances = instanceManager.getInstancesByServer(server.name);
          for (const instance of instances) {
            if (instance.pid === transport.process?.pid && instance.status === 'running') {
              instanceManager.updateInstanceStatus(instance.id, 'stopped');
              console.info(`Updated instance ${instance.id} status to stopped`);
            }
          }
        };
        
        transport.onerror = (e) => {
          console.error(`Transport error for ${server.name}: ${e}`);
          
          // Find the instance ID for this transport process and update its status
          const instances = instanceManager.getInstancesByServer(server.name);
          for (const instance of instances) {
            if (instance.pid === transport.process?.pid && instance.status === 'running') {
              instanceManager.updateInstanceStatus(instance.id, 'error');
              console.info(`Updated instance ${instance.id} status to error`);
            }
          }
        };
        
        transport.onmessage = (message) => {
          console.info(`Transport message from ${server.name}: ${message}`);
        };
        
        // Connect the client to the transport
        try {
          console.info(`Connecting to ${server.name} using StdioClientTransport`);
          await client.connect(transport);
          console.info(`Successfully connected to MCP client: ${server.name}`);
          
          // Initialize with no PID, we'll update it later if it becomes available
          const initialPid = null;
          
          // Test the connection first to get MCP details
          console.info(`Getting MCP details from ${server.name}...`);
          let mcpDetails = null;
          
          try {
            // Get tools to determine MCP capabilities
            const toolsResponse = await client.listTools();
            
            if (!toolsResponse.error) {
              // Create an MCP details object with the information we have
              mcpDetails = {
                toolCount: toolsResponse.tools ? toolsResponse.tools.length : 0,
                toolTypes: toolsResponse.tools ? [...new Set(toolsResponse.tools.map(t => t.type || 'unknown'))] : [],
                capabilities: toolsResponse.tools ? 
                  toolsResponse.tools.reduce((caps, tool) => {
                    if (tool.name) caps.toolNames.add(tool.name);
                    return caps;
                  }, { toolNames: new Set() }) : 
                  { toolNames: new Set() }
              };
              
              // Convert Sets to Arrays for serialization
              mcpDetails.capabilities.toolNames = Array.from(mcpDetails.capabilities.toolNames);
            }
          } catch (detailsError) {
            console.info(`Could not get MCP details for ${server.name}: ${detailsError.message}`);
          }
          
          // Include filterInfo in the server config if applicable
          const serverConfig = {
            ...server,
            toolFilters: this.#toolFilters || [],
            serverFilters: this.#serverFilters || [],
            groupFilters: this.#groupFilters || []
          };
          
          // Register the instance with the instance manager
          const instanceId = instanceManager.registerInstance(
            initialPid,
            cmd,
            server.name,
            'cli',
            JSON.stringify(serverConfig),
            {
              args: allArgs,
              env: env || {},
              cwd: process.cwd()
            },
            'stdio',
            transport,
            mcpDetails
          );
          
          console.info(`Registered server instance ${instanceId} without initial PID`);
          
          // Set up a listener to get the PID once it becomes available
          const checkForPid = setInterval(() => {
            try {
              const currentPid = transport.process?.pid;
              if (currentPid) {
                instanceManager.updateInstancePid(instanceId, currentPid);
                console.info(`Updated instance ${instanceId} with real PID ${currentPid}`);
                clearInterval(checkForPid);
              }
            } catch (error) {
              console.debug(`Error checking for PID: ${error.message}`);
            }
          }, 500); // Check every 500ms
          
          // Clean up the interval after 10 seconds if we still don't have a PID
          setTimeout(() => {
            clearInterval(checkForPid);
            console.info(`Stopped checking for PID for instance ${instanceId}`);
          }, 10000);
          
          // Test the connection by listing tools
          try {
            console.info(`Listing tools from ${server.name}...`);
            const toolsResponse = await client.listTools();
            
            if (toolsResponse.error) {
              console.error(`Error from client ${server.name}: ${JSON.stringify(toolsResponse.error)}`);
              continue;
            }
            
            console.info(`Successfully listed tools from ${server.name}: ${toolsResponse.tools ? toolsResponse.tools.length : 0} tools found`);
            // Register the client
            this.registerClient(server.name, client);
          } catch (toolError) {
            console.error(`Error listing tools from ${server.name}: ${toolError.message}`);
          }
        } catch (connectError) {
          console.error(`Error connecting to ${server.name}: ${connectError.message}`);
          continue;
        }
        
      } catch (error) {
        console.error(`Error connecting to MCP client ${server.name}: ${error.message}`);
      }
    }
    
    console.info(`Connected to ${this.#mcpClients.size} MCP clients`);
  }

  /**
   * Register a client with the MCP server
   * @param {string} clientId - The ID of the client
   * @param {Object} client - The MCP client instance
   */
  registerClient(clientId, client) {
    console.info(`Registering client: ${clientId}`);
    this.#mcpClients.set(clientId, client);
  }

  /**
   * Set up request handlers
   * @private
   */
  #setupRequestHandlers() {
    // Handler for listing tools
    this.#server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.info('Handling ListTools request');

      console.info(`Number of registered clients: ${this.#mcpClients.size}`);
      console.info(`Client IDs: ${Array.from(this.#mcpClients.keys()).join(', ')}`);

      // Array to hold all tools from MCP servers
      const allTools = [];

      // First, add all tools from our own registry
      const localTools = this.#toolRegistry.list();
      const prefixedLocalTools = this.#toolRegistry.addServerPrefixToTools(localTools, 'mcpz');
      allTools.push(...prefixedLocalTools);
      console.info(`Added ${prefixedLocalTools.length} tools from local registry under 'mcpz'`);

      // For each connected MCP client
      for (const [clientId, client] of this.#mcpClients.entries()) {
        try {
          // Get tools from the client
          const toolsResponse = await client.listTools();

          if (toolsResponse.tools && toolsResponse.tools.length > 0) {
            // Add a prefix to each tool name to avoid conflicts
            const prefixedTools = toolsResponse.tools.map(tool => ({
              ...tool,
              name: `${clientId}_${tool.name}`,
              description: `[${clientId}] ${tool.description || 'No description'}`
            }));

            allTools.push(...prefixedTools);
            console.info(`Added ${prefixedTools.length} tools from client '${clientId}'`);
          }
        } catch (error) {
          console.error(`Error fetching tools from client ${clientId}: ${error.message}`);
        }
      }

      // Apply tool filtering if specified
      let filteredTools = allTools;
      if (this.#toolFilters) {
        console.info(`Filtering to tools: ${this.#toolFilters.join(', ')}`);
        
        filteredTools = allTools.filter(tool => {
          // Extract original tool name without server prefix
          const originalName = tool.originalName || 
                              (tool.name.includes('_') ? 
                                tool.name.split('_').slice(1).join('_') : 
                                tool.name);
          
          return this.#toolFilters.includes(originalName);
        });
        
        console.info(`Filtered to ${filteredTools.length} tools out of ${allTools.length} total`);
      } else {
        console.info(`Returning ${allTools.length} tools from all MCP servers`);
      }
      
      return { tools: filteredTools };
    });

    // Handler for calling tools
    this.#server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      console.info(`Handling CallTool request for tool: ${toolName}`);

      // Extract client ID and original tool name from the prefixed tool name
      const parts = toolName.split('_');
      if (parts.length < 2) {
        console.error(`Invalid tool name format: ${toolName}`);
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Invalid tool name format: ${toolName}. Expected format: serverName_toolName`
        );
      }

      const clientId = parts[0];
      const originalToolName = parts.slice(1).join('_');

      console.info(`Routing tool call to client: ${clientId}, tool: ${originalToolName}`);

      // Find the client
      const client = this.#mcpClients.get(clientId);
      if (!client) {
        console.error(`Client not found: ${clientId}`);
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Client not found: ${clientId}`
        );
      }

      // Track tool usage
      await this.#metricsManager.trackUsage(toolName);

      try {
        console.info(`Forwarding tool call to client ${clientId} for tool ${originalToolName}`);

        // Forward the tool call to the original client
        const payload = {
          name: originalToolName,
          arguments: request.params.arguments
        };

        console.info(`Sending payload: ${JSON.stringify(payload)}`);

        // Call the tool
        const result = await client.callTool(payload);

        if (result.error) {
          console.error(`Error from client ${clientId}: ${JSON.stringify(result.error)}`);
          throw new McpError(
            ErrorCode.InternalError,
            `Error from client ${clientId}: ${JSON.stringify(result.error)}`
          );
        }

        console.info(`Tool execution successful: ${originalToolName}`);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Tool execution error: ${errorMessage}`);

        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });

    // Handler for listing resources
    this.#server.setRequestHandler(ListResourcesRequestSchema, async () => {
      console.info('Handling resources list request');
      return { resources: [] };
    });

    // Handler for listing resource templates
    this.#server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      console.info('Handling resources templates list request');
      return { resourceTemplates: [] };
    });
  }

  /**
   * Start the server
   * @param {Object} options - Server options
   * @returns {Promise<void>}
   */
  async start(options = {}) {
    try {
      // Ensure directories exist
      ensureDirectories();

      // Clean up stale instances before starting
      instanceManager.cleanupStaleInstances();
      console.info('Cleaned up stale instances');

      // Parse filters
      this.#serverFilters = this.#parseFilters(options.server, options.servers);
      this.#groupFilters = this.#parseFilters(options.group, options.groups);
      this.#toolFilters = this.#parseFilters(options.tool, options.tools);
      
      // If group filters are specified, expand them to server filters
      if (this.#groupFilters) {
        console.info(`Filtering to groups: ${this.#groupFilters.join(', ')}`);
        
        // Import the expandServerOrGroup function
        const { expandServerOrGroup } = await import('./utils/config.js');
        
        // Create a set to hold all server names after expansion
        const expandedServerNames = new Set();
        
        // Expand each group filter to server names
        for (const filter of this.#groupFilters) {
          try {
            const expanded = expandServerOrGroup(filter);
            expanded.forEach(name => expandedServerNames.add(name));
          } catch (error) {
            console.error(`Error expanding group '${filter}': ${error.message}`);
          }
        }
        
        // If we have server filters already, combine them with the expanded group filters
        if (this.#serverFilters) {
          this.#serverFilters.forEach(server => expandedServerNames.add(server));
        }
        
        // Update server filters with the combined list
        this.#serverFilters = expandedServerNames.size > 0 ? Array.from(expandedServerNames) : null;
      }
      
      // Log filter information
      if (this.#serverFilters) {
        console.info(`Filtering to servers: ${this.#serverFilters.join(', ')}`);
      }
      
      if (this.#toolFilters) {
        console.info(`Filtering to tools: ${this.#toolFilters.join(', ')}`);
      }

      // Clear the tool registry
      await this.#toolRegistry.clearTools();

      // Initialize the tool registry
      await this.#toolRegistry.load();

      // Register this server instance with the actual process PID
      const pid = process.pid;
      const instanceId = instanceManager.registerInstance(
        pid,
        process.argv[0],
        'mcpz-cli-server',
        'cli',
        JSON.stringify({
          name: 'mcpz-cli-server',
          version: CONFIG.server.version,
          options
        }),
        {
          args: process.argv.slice(1),
          env: process.env,
          cwd: process.cwd()
        },
        'stdio'
      );
      console.info(`Registered self with instance ID: ${instanceId} and PID: ${pid}`);

      // Connect to MCP clients
      await this.#connectToMcpClients();

      // Create a stdio transport
      const transport = new StdioServerTransport();

      // Connect the server to the transport
      console.info('Starting server...');
      await this.#server.connect(transport);

      console.info('Server started successfully');
      console.info('Ready to handle requests');      

      // Set up signal handlers for graceful shutdown
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());
    } catch (error) {
      console.error(`Failed to start server: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Stop the server
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      console.info('Shutting down...');
      
      // Update server instance status
      const instances = instanceManager.getInstancesByServer('mcpz-cli-server');
      for (const instance of instances) {
        if (instance.pid === process.pid) {
          instanceManager.updateInstanceStatus(instance.id, 'stopped');
          console.info(`Updated own instance ${instance.id} status to stopped`);
        }
      }
      
      // Kill any child instances that this server created
      const allInstances = instanceManager.getAllInstances();
      let killedCount = 0;
      
      for (const instance of allInstances) {
        if (instance.launchSource === 'cli' && instance.status === 'running') {
          try {
            const success = instanceManager.killInstance(instance.id);
            if (success) {
              killedCount++;
              console.info(`Killed child instance ${instance.id} (PID ${instance.pid})`);
            }
          } catch (error) {
            console.error(`Failed to kill instance ${instance.id}: ${error.message}`);
          }
        }
      }
      
      console.info(`Killed ${killedCount} child instances`);
      
      // Close the MCP server
      await this.#server.close();
      console.info('Server stopped');
      
      // Stop the instance manager's health check
      instanceManager.stopHealthCheck();
      
      process.exit(0);
    } catch (error) {
      console.error(`Error during shutdown: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Gets instance status data for UI display
   * @private
   * @returns {Object} Instance status data
   */
  #getInstancesStatus() {
    const instances = instanceManager.getAllInstances();
    const runningInstances = instances.filter(i => i.status === 'running');
    const errorInstances = instances.filter(i => i.status === 'error');
    
    // Group instances by server name
    const instancesByServer = new Map();
    for (const instance of instances) {
      if (!instancesByServer.has(instance.serverName)) {
        instancesByServer.set(instance.serverName, []);
      }
      instancesByServer.get(instance.serverName).push(instance);
    }
    
    // Create status data for the webview
    return {
      totalInstances: instances.length,
      runningCount: runningInstances.length,
      errorCount: errorInstances.length,
      instancesByServer: Object.fromEntries(instancesByServer),
      servers: Array.from(instancesByServer.keys()),
      timestamp: new Date().toISOString()
    };
  }
}

// Create and start the server
const mcpServer = new McpServer();

// Export the server instance and its methods
const exportedServer = {
  start: (options) => mcpServer.start(options),
  stop: () => mcpServer.stop(),
  registerClient: (clientId, client) => mcpServer.registerClient(clientId, client),
  unregisterClient: (clientId) => mcpServer.unregisterClient(clientId),
  getInstancesStatus: () => mcpServer.getInstancesStatus()
};

// Start the server if this script is run directly
if (process.argv[1] === import.meta.url.substring(7)) {
  mcpServer.start().catch(error => {
    console.error('Main', `Unhandled error: ${error.message}`);
    process.exit(1);
  });
}

export default exportedServer;
