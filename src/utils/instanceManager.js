import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';
import { isLogging } from './config.js';

// Note: Logging is handled directly with console methods throughout the code

/**
 * Manages server instances across CLI and extension contexts
 */
class InstanceManager {
  static #instance;
  #instances = new Map();
  #instancesDir;
  #healthCheckInterval;
  #eventEmitter = new EventEmitter();

  constructor() {
    this.#instancesDir = path.join(os.homedir(), '.mcpz', 'instances');
    this.#ensureInstancesDirectory();
    this.#loadInstances();
    this.#startHealthCheck();
  }

  #ensureInstancesDirectory() {
    try {
      if (!fs.existsSync(this.#instancesDir)) {
        fs.mkdirSync(this.#instancesDir, { recursive: true });
      }
    } catch (error) {
      console.info('Failed to create instances directory', error);
    }
  }

  #loadInstances() {
    try {
      const files = fs.readdirSync(this.#instancesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.#instancesDir, file);
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const instance = JSON.parse(content);
            this.#instances.set(instance.id, instance);
          } catch (error) {
            console.info(`Failed to parse instance file: ${filePath}`, error);
          }
        }
      }
      if (isLogging()) {
        // Intentionally empty for logging in debug mode
      }
    } catch (error) {
      console.info('Failed to load instance records', error);
    }
  }

  #saveInstance(instance) {
    try {
      const filePath = path.join(this.#instancesDir, `${instance.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(instance, null, 2));
    } catch (error) {
      console.info(`Failed to save instance: ${instance.id}`, error);
    }
  }

  /**
   * Registers a new server instance
   * @param {number|null} pid - Process ID (can be null if not immediately available)
   * @param {string} serverPath - Path to the server executable
   * @param {string} serverName - Name of the server
   * @param {string} launchSource - Source of the launch (cli or extension)
   * @param {string} serverConfig - Serialized server configuration
   * @param {Object} contextInfo - Additional context information
   * @param {string} connectionType - Type of connection (stdio or sse)
   * @param {Object|null} transport - Transport object that may contain process information (optional)
   * @param {Object|null} mcpDetails - Additional details about the MCP server (optional)
   * @returns {string} - Instance ID
   */
  registerInstance(pid, serverPath, serverName, launchSource, serverConfig, contextInfo, connectionType, transport = null, mcpDetails = null) {
    const id = `${serverName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Parse the server config to extract useful information
    let parsedConfig = {};
    try {
      if (typeof serverConfig === 'string') {
        parsedConfig = JSON.parse(serverConfig);
      } else if (typeof serverConfig === 'object') {
        parsedConfig = serverConfig;
      }
    } catch (error) {
      console.info(`Failed to parse server config for ${serverName}`, error);
    }
    
    const instance = {
      id,
      pid,
      serverPath,
      serverName,
      launchSource,
      startTime: Date.now(),
      // Extract and store key configuration details for display
      displayInfo: {
        type: parsedConfig.type || 'unknown',
        enabled: parsedConfig.enabled !== false,
        filters: {
          tools: parsedConfig.toolFilters || [],
          servers: parsedConfig.serverFilters || [],
          groups: parsedConfig.groupFilters || []
        },
        command: parsedConfig.command || serverPath,
        args: parsedConfig.args || (contextInfo && contextInfo.args ? contextInfo.args : [])
      },
      // Store the original full config for reference
      serverConfig,
      contextInfo,
      connectionType,
      lastHealthCheck: Date.now(),
      status: 'running',
      // Store transport reference to access process information later if PID is not available yet
      transport: transport ? true : false,
      // Store resource usage if provided
      resourceUsage: null,
      // Store any specific MCP details provided
      mcpDetails: mcpDetails || null
    };

    this.#instances.set(id, instance);
    this.#saveInstance(instance);
    this.#eventEmitter.emit('instance_added', instance);
    this.#eventEmitter.emit('instances_changed', this.getAllInstances());
    return id;
  }
  
  /**
   * Updates an instance's PID when it becomes available
   * @param {string} id - Instance ID
   * @param {number} pid - Process ID
   * @returns {boolean} - Whether the update was successful
   */
  updateInstancePid(id, pid) {
    const instance = this.#instances.get(id);
    if (!instance) {
      return false;
    }
    
    instance.pid = pid;
    this.#saveInstance(instance);
    return true;
  }

  /**
   * Removes a server instance
   */
  removeInstance(id) {
    if (!this.#instances.has(id)) {
      return false;
    }

    try {
      const filePath = path.join(this.#instancesDir, `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      const instance = this.#instances.get(id);
      this.#instances.delete(id);
      
      this.#eventEmitter.emit('instance_removed', instance);
      this.#eventEmitter.emit('instances_changed', this.getAllInstances());
      return true;
    } catch (error) {
      console.info(`Failed to remove instance: ${id}`, error);
      return false;
    }
  }

  /**
   * Updates an instance's status
   */
  updateInstanceStatus(id, status) {
    const instance = this.#instances.get(id);
    if (!instance) {
      return false;
    }

    instance.status = status;
    instance.lastHealthCheck = Date.now();
    this.#saveInstance(instance);
    
    this.#eventEmitter.emit('instance_status_changed', instance);
    this.#eventEmitter.emit('instances_changed', this.getAllInstances());
    return true;
  }

  /**
   * Gets all instances as an array
   */
  getAllInstances() {
    return Array.from(this.#instances.values());
  }

  /**
   * Gets instances for a specific server
   */
  getInstancesByServer(serverName) {
    return this.getAllInstances().filter(instance => instance.serverName === serverName);
  }

  /**
   * Gets an instance by ID
   */
  getInstance(id) {
    return this.#instances.get(id);
  }

  /**
   * Checks if a process is still running
   * @param {number|null} pid - Process ID to check
   * @returns {boolean} - Whether the process is running
   */
  #isPidRunning(pid) {
    // If no PID is available, we can't determine if it's running
    if (pid === null || pid === undefined) {
      return false;
    }
    
    try {
      return process.kill(pid, 0);
    } catch (e) {
      return false;
    }
  }

  /**
   * Fetches resource usage for a process
   * @param {number} pid - Process ID to check
   * @returns {Promise<Object|null>} - Resource usage information or null if unavailable
   */
  async #getProcessResourceUsage(pid) {
    if (!pid) return null;
    
    try {
      // Use `ps` command to get memory and CPU usage on Unix-like systems
      const { promisify } = await import('util');
      const exec = promisify((await import('child_process')).exec);
      
      const { stdout } = await exec(`ps -o pid,pcpu,pmem,rss,vsz,time -p ${pid}`);
      const lines = stdout.trim().split('\n');
      
      if (lines.length >= 2) {
        const headers = lines[0].trim().split(/\s+/);
        const values = lines[1].trim().split(/\s+/);
        
        const result = {};
        for (let i = 0; i < headers.length; i++) {
          result[headers[i].toLowerCase()] = values[i];
        }
        
        // Convert RSS from KB to MB for readability
        if (result.rss) {
          result.memory = (parseInt(result.rss) / 1024).toFixed(1) + ' MB';
        }
        
        // Add CPU percentage
        if (result.pcpu) {
          result.cpu = result.pcpu + '%';
        }
        
        // Add uptime in a readable format
        if (result.time) {
          result.uptime = result.time;
        }
        
        return result;
      }
    } catch (error) {
      // Silently fail - resource usage is non-critical
      console.debug(`Error getting resource usage for PID ${pid}:`, error);
    }
    
    return null;
  }

  /**
   * Performs health checks on all instances
   */
  #performHealthCheck() {
    for (const instance of this.#instances.values()) {
      // Check if the process is still running
      const isRunning = instance.pid ? this.#isPidRunning(instance.pid) : false;
      
      if (!isRunning && instance.status === 'running') {
        if (instance.pid) {
          console.warn(`Instance ${instance.id} (PID: ${instance.pid}) is no longer running`);
        } else {
          console.warn(`Instance ${instance.id} (PID not available) is considered not running`);
        }
        this.updateInstanceStatus(instance.id, 'error');
      } else if (instance.status === 'running') {
        instance.lastHealthCheck = Date.now();
        
        // Update resource usage information for running processes with PIDs
        if (instance.pid) {
          this.#getProcessResourceUsage(instance.pid).then(resourceUsage => {
            if (resourceUsage) {
              instance.resourceUsage = resourceUsage;
              this.#saveInstance(instance);
              // Notify listeners of the update
              this.#eventEmitter.emit('instance_updated', instance);
              this.#eventEmitter.emit('instances_changed', this.getAllInstances());
            }
          }).catch(error => {
            console.debug(`Failed to get resource usage for instance ${instance.id}:`, error);
          });
        }
        
        this.#saveInstance(instance);
      }
    }
  }

  /**
   * Starts the health check interval
   */
  #startHealthCheck() {
    if (this.#healthCheckInterval) {
      clearInterval(this.#healthCheckInterval);
    }

    // Check every 30 seconds
    this.#healthCheckInterval = setInterval(() => {
      this.#performHealthCheck();
    }, 30000);
  }

  /**
   * Stops the health check interval
   */
  stopHealthCheck() {
    if (this.#healthCheckInterval) {
      clearInterval(this.#healthCheckInterval);
      this.#healthCheckInterval = undefined;
    }
  }

  /**
   * Kills a server instance
   * @param {string} id - Instance ID to kill
   * @returns {boolean} - Whether the kill was successful
   */
  killInstance(id) {
    const instance = this.#instances.get(id);
    if (!instance) {
      return false;
    }

    try {
      // If we don't have a PID, we can't kill the process directly
      if (!instance.pid) {
        console.info(`No PID available for instance ${id}, marking as stopped`);
        this.updateInstanceStatus(id, 'stopped');
        return true;
      }
      
      // Try to kill the process
      process.kill(instance.pid);
      this.updateInstanceStatus(id, 'stopped');
      return true;
    } catch (error) {
      console.info(`Failed to kill instance ${id}`, error);
      
      // If we can't kill it, still mark it as stopped for cleanup
      this.updateInstanceStatus(id, 'stopped');
      return false;
    }
  }

  /**
   * Cleans up stale instances
   */
  cleanupStaleInstances() {
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    const instancesToRemove = [];

    for (const instance of this.#instances.values()) {
      // Remove instances with error or stopped status (they're not running anyway)
      if (instance.status === 'error' || instance.status === 'stopped') {
        instancesToRemove.push(instance.id);
        continue;
      }

      if (instance.status === 'running') {
        // For instances without a PID, consider them stale after an hour of inactivity
        if (!instance.pid) {
          if (now - instance.lastHealthCheck > oneHourMs) {
            instancesToRemove.push(instance.id);
          }
        } else {
          // For instances with PIDs, check if the process is still running
          const isRunning = this.#isPidRunning(instance.pid);
          if (!isRunning) {
            instancesToRemove.push(instance.id);
          }
        }
      }
    }

    // Remove all stale instances
    for (const id of instancesToRemove) {
      this.removeInstance(id);
    }

    if (instancesToRemove.length > 0 && isLogging()) {
      console.info(`Cleaned up ${instancesToRemove.length} stale instance(s)`);
    }
  }

  /**
   * Subscribe to events
   */
  on(event, listener) {
    this.#eventEmitter.on(event, listener);
    return this;
  }

  /**
   * Unsubscribe from events
   */
  off(event, listener) {
    this.#eventEmitter.off(event, listener);
    return this;
  }

  /**
   * Gets the singleton instance
   */
  static getInstance() {
    if (!InstanceManager.#instance) {
      InstanceManager.#instance = new InstanceManager();
    }
    return InstanceManager.#instance;
  }
}

// Export events as constants for potential external use
export const INSTANCE_EVENTS = {
  INSTANCE_ADDED: 'instance_added',
  INSTANCE_REMOVED: 'instance_removed',
  INSTANCE_STATUS_CHANGED: 'instance_status_changed',
  INSTANCE_UPDATED: 'instance_updated',
  INSTANCES_CHANGED: 'instances_changed'
};

export { 
  InstanceManager
};
