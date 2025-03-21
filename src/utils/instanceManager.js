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
   */
  registerInstance(pid, serverPath, serverName, launchSource, serverConfig, contextInfo, connectionType) {
    const id = `${serverName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const instance = {
      id,
      pid,
      serverPath,
      serverName,
      launchSource,
      startTime: Date.now(),
      serverConfig,
      contextInfo,
      connectionType,
      lastHealthCheck: Date.now(),
      status: 'running'
    };

    this.#instances.set(id, instance);
    this.#saveInstance(instance);
    this.#eventEmitter.emit('instance_added', instance);
    this.#eventEmitter.emit('instances_changed', this.getAllInstances());
    return id;
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
   */
  #isPidRunning(pid) {
    // If it's a fake PID, consider it "running"
    if (this.#isFakePid(pid)) {
      return true;
    }
    
    try {
      return process.kill(pid, 0);
    } catch (e) {
      return false;
    }
  }

  /**
   * Performs health checks on all instances
   */
  #performHealthCheck() {
    for (const instance of this.#instances.values()) {
      // Check if the process is still running
      const isRunning = this.#isPidRunning(instance.pid);
      
      if (!isRunning && instance.status === 'running') {
        console.warn(`Instance ${instance.id} (PID: ${instance.pid}) is no longer running`);
        this.updateInstanceStatus(instance.id, 'error');
      } else if (instance.status === 'running') {
        instance.lastHealthCheck = Date.now();
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
   */
  killInstance(id) {
    const instance = this.#instances.get(id);
    if (!instance) {
      return false;
    }

    try {
      // If it's a fake PID, just mark it as stopped without trying to kill it
      if (this.#isFakePid(instance.pid)) {
        if (isLogging()) {
          // Intentionally empty for logging in debug mode
        }
        this.updateInstanceStatus(id, 'stopped');
        return true;
      }
      
      // For real PIDs, try to kill the process
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
   * Checks if a PID is likely a fake/generated PID
   */
  #isFakePid(pid) {
    // Heuristic to identify fake PIDs (they are typically large random numbers)
    return pid > 10000 && pid < 1000000 && !Number.isInteger(pid / 100);
  }

  /**
   * Cleans up stale instances
   */
  cleanupStaleInstances() {
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    
    for (const instance of this.#instances.values()) {
      if (instance.status === 'running') {
        // If it's a fake PID, only remove if it's been inactive for an hour
        if (this.#isFakePid(instance.pid)) {
          if (now - instance.lastHealthCheck > oneHourMs) {
            console.warn(`Removing stale instance with fake PID ${instance.id} (PID: ${instance.pid}) after inactivity`);
            this.removeInstance(instance.id);
          }
        } else {
          // For real PIDs, check if the process is still running
          const isRunning = this.#isPidRunning(instance.pid);
          if (!isRunning) {
            console.warn(`Removing stale instance ${instance.id} (PID: ${instance.pid})`);
            this.removeInstance(instance.id);
          }
        }
      }
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
  INSTANCES_CHANGED: 'instances_changed'
};

export { 
  InstanceManager
};
