import assert from 'node:assert';
import { describe, it, before, after, beforeEach, afterEach, mock } from 'node:test';
import fs from 'fs';
import path from 'path';
import os from 'os';

// We need to test the InstanceManager class
// Since it's a singleton, we'll test its public API

describe('InstanceManager', () => {
  const TEST_DIR = path.join(os.tmpdir(), 'mcpz-instance-test-' + Date.now());
  const TEST_INSTANCES_DIR = path.join(TEST_DIR, '.mcpz', 'instances');

  let InstanceManager;
  let instanceManager;
  let originalHomedir;

  before(async () => {
    // Create test directory
    fs.mkdirSync(TEST_INSTANCES_DIR, { recursive: true });

    // We can't easily mock os.homedir for the singleton, so we'll test the behavior
    // with the actual instance manager but clean up after ourselves
    const module = await import('../src/utils/instanceManager.js');
    InstanceManager = module.InstanceManager;
    instanceManager = InstanceManager.getInstance();
  });

  after(() => {
    // Stop health check to prevent interference
    instanceManager.stopHealthCheck();

    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up any instances created during tests
    const instances = instanceManager.getAllInstances();
    for (const instance of instances) {
      if (instance.serverName.startsWith('test-')) {
        instanceManager.removeInstance(instance.id);
      }
    }
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = InstanceManager.getInstance();
      const instance2 = InstanceManager.getInstance();

      assert.strictEqual(instance1, instance2);
    });
  });

  describe('registerInstance', () => {
    it('should register a new instance and return an ID', () => {
      const id = instanceManager.registerInstance(
        12345,
        '/path/to/server',
        'test-server-1',
        'cli',
        JSON.stringify({ name: 'test' }),
        { cwd: '/test' },
        'stdio'
      );

      assert.ok(id);
      assert.ok(id.startsWith('test-server-1-'));

      // Clean up
      instanceManager.removeInstance(id);
    });

    it('should register instance without PID', () => {
      const id = instanceManager.registerInstance(
        null,
        '/path/to/server',
        'test-server-2',
        'cli',
        JSON.stringify({ name: 'test' }),
        {},
        'stdio'
      );

      const instance = instanceManager.getInstance(id);
      assert.strictEqual(instance.pid, null);

      // Clean up
      instanceManager.removeInstance(id);
    });

    it('should include display info from server config', () => {
      const serverConfig = {
        type: 'process',
        enabled: true,
        toolFilters: ['tool1'],
        serverFilters: ['server1'],
        groupFilters: ['group1'],
        command: 'node',
        args: ['server.js']
      };

      const id = instanceManager.registerInstance(
        null,
        '/path/to/server',
        'test-server-3',
        'cli',
        JSON.stringify(serverConfig),
        {},
        'stdio'
      );

      const instance = instanceManager.getInstance(id);
      assert.strictEqual(instance.displayInfo.type, 'process');
      assert.strictEqual(instance.displayInfo.enabled, true);
      assert.deepStrictEqual(instance.displayInfo.filters.tools, ['tool1']);

      // Clean up
      instanceManager.removeInstance(id);
    });

    it('should include MCP details when provided', () => {
      const mcpDetails = {
        toolCount: 5,
        toolTypes: ['search', 'action'],
        capabilities: { toolNames: ['tool1', 'tool2'] }
      };

      const id = instanceManager.registerInstance(
        null,
        '/path/to/server',
        'test-server-4',
        'cli',
        '{}',
        {},
        'stdio',
        null,
        mcpDetails
      );

      const instance = instanceManager.getInstance(id);
      assert.deepStrictEqual(instance.mcpDetails, mcpDetails);

      // Clean up
      instanceManager.removeInstance(id);
    });
  });

  describe('updateInstancePid', () => {
    it('should update the PID of an existing instance', () => {
      const id = instanceManager.registerInstance(
        null,
        '/path/to/server',
        'test-server-5',
        'cli',
        '{}',
        {},
        'stdio'
      );

      const result = instanceManager.updateInstancePid(id, 99999);

      assert.strictEqual(result, true);

      const instance = instanceManager.getInstance(id);
      assert.strictEqual(instance.pid, 99999);

      // Clean up
      instanceManager.removeInstance(id);
    });

    it('should return false for non-existent instance', () => {
      const result = instanceManager.updateInstancePid('non-existent-id', 12345);

      assert.strictEqual(result, false);
    });
  });

  describe('updateInstanceStatus', () => {
    it('should update the status of an existing instance', () => {
      const id = instanceManager.registerInstance(
        null,
        '/path/to/server',
        'test-server-6',
        'cli',
        '{}',
        {},
        'stdio'
      );

      const result = instanceManager.updateInstanceStatus(id, 'stopped');

      assert.strictEqual(result, true);

      const instance = instanceManager.getInstance(id);
      assert.strictEqual(instance.status, 'stopped');

      // Clean up
      instanceManager.removeInstance(id);
    });

    it('should return false for non-existent instance', () => {
      const result = instanceManager.updateInstanceStatus('non-existent-id', 'error');

      assert.strictEqual(result, false);
    });

    it('should update lastHealthCheck when updating status', () => {
      const id = instanceManager.registerInstance(
        null,
        '/path/to/server',
        'test-server-7',
        'cli',
        '{}',
        {},
        'stdio'
      );

      const beforeTime = Date.now();
      instanceManager.updateInstanceStatus(id, 'running');

      const instance = instanceManager.getInstance(id);
      assert.ok(instance.lastHealthCheck >= beforeTime);

      // Clean up
      instanceManager.removeInstance(id);
    });
  });

  describe('removeInstance', () => {
    it('should remove an existing instance', () => {
      const id = instanceManager.registerInstance(
        null,
        '/path/to/server',
        'test-server-8',
        'cli',
        '{}',
        {},
        'stdio'
      );

      const result = instanceManager.removeInstance(id);

      assert.strictEqual(result, true);
      assert.strictEqual(instanceManager.getInstance(id), undefined);
    });

    it('should return false for non-existent instance', () => {
      const result = instanceManager.removeInstance('non-existent-id');

      assert.strictEqual(result, false);
    });
  });

  describe('getAllInstances', () => {
    it('should return all instances as an array', () => {
      const id1 = instanceManager.registerInstance(null, '/path', 'test-server-9a', 'cli', '{}', {}, 'stdio');
      const id2 = instanceManager.registerInstance(null, '/path', 'test-server-9b', 'cli', '{}', {}, 'stdio');

      const instances = instanceManager.getAllInstances();

      assert.ok(Array.isArray(instances));

      const testInstances = instances.filter(i => i.serverName.startsWith('test-server-9'));
      assert.strictEqual(testInstances.length, 2);

      // Clean up
      instanceManager.removeInstance(id1);
      instanceManager.removeInstance(id2);
    });
  });

  describe('getInstancesByServer', () => {
    it('should return instances for a specific server', () => {
      const id1 = instanceManager.registerInstance(null, '/path', 'test-specific-server', 'cli', '{}', {}, 'stdio');
      const id2 = instanceManager.registerInstance(null, '/path', 'test-specific-server', 'cli', '{}', {}, 'stdio');
      const id3 = instanceManager.registerInstance(null, '/path', 'test-other-server', 'cli', '{}', {}, 'stdio');

      const instances = instanceManager.getInstancesByServer('test-specific-server');

      assert.strictEqual(instances.length, 2);
      instances.forEach(i => {
        assert.strictEqual(i.serverName, 'test-specific-server');
      });

      // Clean up
      instanceManager.removeInstance(id1);
      instanceManager.removeInstance(id2);
      instanceManager.removeInstance(id3);
    });

    it('should return empty array for non-existent server', () => {
      const instances = instanceManager.getInstancesByServer('non-existent-server');

      assert.deepStrictEqual(instances, []);
    });
  });

  describe('killInstance', () => {
    it('should mark instance as stopped when no PID available', () => {
      const id = instanceManager.registerInstance(
        null,
        '/path/to/server',
        'test-server-10',
        'cli',
        '{}',
        {},
        'stdio'
      );

      const result = instanceManager.killInstance(id);

      assert.strictEqual(result, true);

      const instance = instanceManager.getInstance(id);
      assert.strictEqual(instance.status, 'stopped');

      // Clean up
      instanceManager.removeInstance(id);
    });

    it('should return false for non-existent instance', () => {
      const result = instanceManager.killInstance('non-existent-id');

      assert.strictEqual(result, false);
    });
  });

  describe('Event Handling', () => {
    it('should emit instance_added event when registering', (t, done) => {
      const listener = (instance) => {
        assert.ok(instance.serverName.startsWith('test-'));
        instanceManager.off('instance_added', listener);
        instanceManager.removeInstance(instance.id);
        done();
      };

      instanceManager.on('instance_added', listener);

      instanceManager.registerInstance(
        null,
        '/path/to/server',
        'test-server-11',
        'cli',
        '{}',
        {},
        'stdio'
      );
    });

    it('should emit instance_removed event when removing', (t, done) => {
      const id = instanceManager.registerInstance(
        null,
        '/path/to/server',
        'test-server-12',
        'cli',
        '{}',
        {},
        'stdio'
      );

      const listener = (instance) => {
        assert.strictEqual(instance.id, id);
        instanceManager.off('instance_removed', listener);
        done();
      };

      instanceManager.on('instance_removed', listener);
      instanceManager.removeInstance(id);
    });

    it('should emit instances_changed event on changes', (t, done) => {
      const listener = (instances) => {
        assert.ok(Array.isArray(instances));
        instanceManager.off('instances_changed', listener);
        done();
      };

      instanceManager.on('instances_changed', listener);

      const id = instanceManager.registerInstance(
        null,
        '/path/to/server',
        'test-server-13',
        'cli',
        '{}',
        {},
        'stdio'
      );

      // Clean up (this will trigger another event, but listener is already removed)
      setTimeout(() => instanceManager.removeInstance(id), 10);
    });
  });

  describe('stopHealthCheck', () => {
    it('should stop the health check interval without error', () => {
      // This should not throw
      instanceManager.stopHealthCheck();

      // Start it again for other tests
      // Note: We can't easily restart it without access to private method
    });
  });
});
