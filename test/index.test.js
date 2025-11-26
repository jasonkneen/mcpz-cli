import { test, describe, it } from 'node:test';
import assert from 'node:assert';

// Basic tests to verify test environment

describe('Test Environment', () => {
  it('verifies test environment works', () => {
    assert.strictEqual(1, 1);
  });

  it('supports async tests', async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(true);
  });

  it('supports assertions', () => {
    assert.deepStrictEqual({ a: 1 }, { a: 1 });
    assert.notStrictEqual('hello', 'world');
    assert.ok(true);
  });
});

describe('Module Loading', () => {
  it('can import config module', async () => {
    const config = await import('../src/utils/config.js');
    assert.ok(config.readConfig);
    assert.ok(config.writeConfig);
    assert.ok(config.addServer);
    assert.ok(config.removeServer);
  });

  it('can import log module', async () => {
    const log = await import('../src/utils/log.js');
    assert.ok(log.default);
    assert.ok(log.default.info);
    assert.ok(log.default.error);
    assert.ok(log.default.warn);
  });

  it('can import add command', async () => {
    const add = await import('../src/commands/add.js');
    assert.ok(add.add);
  });

  it('can import remove command', async () => {
    const remove = await import('../src/commands/remove.js');
    assert.ok(remove.remove);
  });

  it('can import list command', async () => {
    const list = await import('../src/commands/list.js');
    assert.ok(list.list);
  });

  it('can import tools command', async () => {
    const tools = await import('../src/commands/tools.js');
    assert.ok(tools.tools);
  });

  it('can import groups command', async () => {
    const groups = await import('../src/commands/groups.js');
    assert.ok(groups.addGroup);
    assert.ok(groups.removeGroup);
    assert.ok(groups.listGroups);
  });

  it('can import instance manager', async () => {
    const im = await import('../src/utils/instanceManager.js');
    assert.ok(im.InstanceManager);
    assert.ok(im.INSTANCE_EVENTS);
  });
});

describe('Type Checks', () => {
  it('UUID module exports v4', async () => {
    const { v4 } = await import('uuid');
    assert.ok(typeof v4 === 'function');

    const uuid = v4();
    assert.ok(typeof uuid === 'string');
    assert.ok(uuid.length === 36);
  });

  it('chalk module is available', async () => {
    const chalk = await import('chalk');
    assert.ok(chalk.default);
    assert.ok(typeof chalk.default.green === 'function');
  });
});
