#!/usr/bin/env node
import React from 'react';
import { render, Box, Text, useInput, useApp, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import Fuse from 'fuse.js';
import { spawn } from 'child_process';
import { InstanceManager } from '../utils/instanceManager.js';
import { readConfig, getGroups } from '../utils/config.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const { useState, useEffect, useCallback, useMemo, createElement: h } = React;

// Dynamic path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const binPath = path.resolve(__dirname, '../../dist/index.js');

// History file
const homedir = process.env.HOME || process.env.USERPROFILE || os.homedir();
const historyFile = path.join(homedir, '.mcpz_history');
const MAX_HISTORY = 100;

// Available commands for autocomplete
const COMMANDS = [
  { name: '/help', description: 'Show available commands' },
  { name: '/list', description: 'List all configured MCP servers' },
  { name: '/servers', description: 'List all servers' },
  { name: '/tools', description: 'List available tools' },
  { name: '/groups', description: 'List server groups' },
  { name: '/run', description: 'Run MCP server (--server, --tools, --group)' },
  { name: '/use', description: 'Use a specific MCP server' },
  { name: '/add', description: 'Add new MCP configuration' },
  { name: '/remove', description: 'Remove MCP configuration' },
  { name: '/status', description: 'Show running instances status' },
  { name: '/kill', description: 'Kill a running instance' },
  { name: '/clear', description: 'Clear screen output' },
  { name: '/exit', description: 'Exit interactive mode' },
  { name: '/quit', description: 'Exit interactive mode' },
];

// Load command history from file
function loadHistory() {
  try {
    if (fs.existsSync(historyFile)) {
      return fs.readFileSync(historyFile, 'utf-8').split('\n').filter(Boolean);
    }
  } catch {
    // Silently fail
  }
  return [];
}

// Save command to history
function saveHistory(history) {
  try {
    fs.writeFileSync(historyFile, history.slice(0, MAX_HISTORY).join('\n'));
  } catch {
    // Silently fail
  }
}

// Status Bar Component
function StatusBar({ instances, servers, groups }) {
  const runningCount = instances.filter(i => i.status === 'running').length;
  const errorCount = instances.filter(i => i.status === 'error').length;

  return h(Box, {
    borderStyle: 'round',
    borderColor: 'cyan',
    paddingX: 1,
    width: '100%'
  },
  h(Text, null,
    h(Text, { color: 'green' }, 'Running: '),
    h(Text, { color: 'yellow' }, runningCount),
    h(Text, null, ' | '),
    errorCount > 0 && h(React.Fragment, null,
      h(Text, { color: 'red' }, 'Errors: '),
      h(Text, { color: 'yellow' }, errorCount),
      h(Text, null, ' | ')
    ),
    h(Text, { color: 'green' }, 'Servers: '),
    h(Text, { color: 'yellow' }, servers.length),
    h(Text, null, ' | '),
    h(Text, { color: 'green' }, 'Groups: '),
    h(Text, { color: 'yellow' }, Object.keys(groups).length)
  )
  );
}

// Autocomplete Suggestions Component
function AutocompleteSuggestions({ suggestions, selectedIndex }) {
  if (suggestions.length === 0) return null;

  return h(Box, {
    flexDirection: 'column',
    marginTop: 1,
    borderStyle: 'single',
    borderColor: 'gray',
    paddingX: 1
  },
  h(Text, { color: 'gray', dimColor: true }, 'Suggestions (Tab to select, Enter to confirm):'),
  ...suggestions.slice(0, 5).map((suggestion, index) =>
    h(Text, { key: index, color: index === selectedIndex ? 'cyan' : 'white' },
      index === selectedIndex ? '> ' : '  ',
      h(Text, { bold: index === selectedIndex }, suggestion.name),
      suggestion.description && h(Text, { color: 'gray', dimColor: true }, ' - ' + suggestion.description)
    )
  ),
  suggestions.length > 5 && h(Text, { color: 'gray', dimColor: true }, '...and ' + (suggestions.length - 5) + ' more')
  );
}

// Output Line Component
function OutputLine({ line }) {
  if (line.type === 'command') {
    return h(Text, { color: 'cyan' }, '> ' + line.content);
  } else if (line.type === 'error') {
    return h(Text, { color: 'red' }, line.content);
  } else if (line.type === 'success') {
    return h(Text, { color: 'green' }, line.content);
  } else if (line.type === 'info') {
    return h(Text, { color: 'blue' }, line.content);
  } else if (line.type === 'warning') {
    return h(Text, { color: 'yellow' }, line.content);
  } else if (line.type === 'running') {
    return h(Text, null,
      h(Text, { color: 'yellow' }, h(Spinner, { type: 'dots' })),
      h(Text, null, ' Running...')
    );
  }
  return h(Text, null, line.content);
}

// Help Panel Component
function HelpPanel() {
  return h(Box, {
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: 'green',
    paddingX: 1,
    marginY: 1
  },
  h(Text, { color: 'green', bold: true }, 'Available Commands:'),
  h(Text, null, ' '),
  ...COMMANDS.map((cmd, idx) =>
    h(Text, { key: idx },
      h(Text, { color: 'cyan' }, cmd.name.padEnd(12)),
      h(Text, { color: 'gray' }, ' ' + cmd.description)
    )
  ),
  h(Text, null, ' '),
  h(Text, { color: 'gray', dimColor: true }, 'Type a command or use Tab for autocomplete')
  );
}

// Running Instances Component
function RunningInstances({ instances }) {
  const running = instances.filter(i => i.status === 'running');
  if (running.length === 0) return null;

  return h(Box, {
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: 'green',
    paddingX: 1,
    marginY: 1
  },
  h(Text, { color: 'green', bold: true }, 'Running Instances:'),
  ...running.map((instance, idx) =>
    h(Box, { key: idx },
      h(Text, { color: 'green' }, instance.serverName),
      instance.pid && h(Text, { color: 'gray' }, ' (PID: ' + instance.pid + ')'),
      instance.resourceUsage?.memory && h(Text, { color: 'magenta' }, ' Mem: ' + instance.resourceUsage.memory)
    )
  )
  );
}

// Main Interactive App Component
function InteractiveApp() {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();

  // State
  const [input, setInput] = useState('');
  const [output, setOutput] = useState([
    { type: 'info', content: 'Welcome to mcpz interactive mode!' },
    { type: 'info', content: 'Type /help for available commands, Tab for autocomplete' },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState(loadHistory);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [servers, setServers] = useState([]);
  const [groups, setGroups] = useState({});
  const [instances, setInstances] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  // Load config on mount
  useEffect(() => {
    const config = readConfig();
    setServers(config.servers || []);
    setGroups(getGroups());

    // Load instances
    const instanceManager = InstanceManager.getInstance();
    setInstances(instanceManager.getAllInstances());

    // Listen for instance changes
    const handleInstancesChanged = (updatedInstances) => {
      setInstances(updatedInstances);
    };
    instanceManager.on('instances_changed', handleInstancesChanged);

    return () => {
      instanceManager.off('instances_changed', handleInstancesChanged);
      instanceManager.stopHealthCheck();
    };
  }, []);

  // Build autocomplete items
  const autocompleteItems = useMemo(() => {
    const items = [
      ...COMMANDS,
      ...servers.map(s => ({
        name: s.name,
        description: 'Server: ' + s.command,
        type: 'server'
      })),
      ...Object.keys(groups).map(g => ({
        name: g,
        description: 'Group: ' + groups[g].join(', '),
        type: 'group'
      }))
    ];
    return items;
  }, [servers, groups]);

  // Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(autocompleteItems, {
      keys: ['name', 'description'],
      threshold: 0.3,
      includeScore: true
    });
  }, [autocompleteItems]);

  // Update suggestions based on input
  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      setSelectedSuggestion(0);
      return;
    }

    const results = fuse.search(input);
    setSuggestions(results.map(r => r.item));
    setSelectedSuggestion(0);
  }, [input, fuse]);

  // Add output line
  const addOutput = useCallback((line) => {
    setOutput(prev => [...prev.slice(-50), line]);
  }, []);

  // Run CLI command
  const runCliCommand = useCallback((command) => {
    return new Promise((resolve, reject) => {
      const args = command.split(' ');
      const child = spawn('node', [binPath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ stdout, stderr, code });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }, []);

  // Execute command
  const executeCommand = useCallback(async (command) => {
    addOutput({ type: 'command', content: command });

    const trimmed = command.trim();

    // Handle slash commands
    if (trimmed.startsWith('/')) {
      const parts = trimmed.slice(1).split(' ');
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      switch (cmd) {
      case 'help':
        setShowHelp(true);
        return;

      case 'clear':
        setOutput([]);
        setShowHelp(false);
        return;

      case 'exit':
      case 'quit':
        exit();
        return;

      case 'list':
      case 'servers':
        if (servers.length === 0) {
          addOutput({ type: 'warning', content: 'No servers configured' });
        } else {
          addOutput({ type: 'info', content: 'Configured Servers:' });
          servers.forEach(s => {
            addOutput({
              type: 'output',
              content: '  ' + s.name + ' - ' + s.command + ' ' + (s.enabled ? '(enabled)' : '(disabled)')
            });
          });
        }
        return;

      case 'groups':
        const groupNames = Object.keys(groups);
        if (groupNames.length === 0) {
          addOutput({ type: 'warning', content: 'No groups defined' });
        } else {
          addOutput({ type: 'info', content: 'Server Groups:' });
          groupNames.forEach(g => {
            addOutput({ type: 'output', content: '  ' + g + ': ' + groups[g].join(', ') });
          });
        }
        return;

      case 'status':
        const running = instances.filter(i => i.status === 'running');
        if (running.length === 0) {
          addOutput({ type: 'warning', content: 'No running instances' });
        } else {
          addOutput({ type: 'info', content: 'Running Instances:' });
          running.forEach(i => {
            addOutput({
              type: 'output',
              content: '  ' + i.serverName + ' - PID: ' + (i.pid || 'N/A') + ' - ' + i.status
            });
          });
        }
        return;

      case 'kill':
        if (args.length === 0) {
          addOutput({ type: 'error', content: 'Usage: /kill <server-name|instance-id>' });
          return;
        }
        const toKill = args[0];
        const instanceManager = InstanceManager.getInstance();
        const targetInstances = instances.filter(
          i => i.serverName === toKill || i.id === toKill
        );
        if (targetInstances.length === 0) {
          addOutput({ type: 'error', content: 'No instance found: ' + toKill });
        } else {
          targetInstances.forEach(i => {
            const success = instanceManager.killInstance(i.id);
            if (success) {
              addOutput({ type: 'success', content: 'Killed instance: ' + i.serverName });
            } else {
              addOutput({ type: 'error', content: 'Failed to kill: ' + i.serverName });
            }
          });
        }
        return;

      case 'tools':
        addOutput({ type: 'info', content: 'Fetching tools (this runs the MCP server)...' });
        break;

      default:
        break;
      }
    }

    // Execute via CLI
    setIsRunning(true);
    addOutput({ type: 'running' });

    try {
      let cliCommand = trimmed;
      if (cliCommand.startsWith('/')) {
        cliCommand = cliCommand.slice(1);
      }

      const result = await runCliCommand(cliCommand);

      setOutput(prev => prev.filter(line => line.type !== 'running'));

      if (result.stdout.trim()) {
        result.stdout.trim().split('\n').forEach(line => {
          addOutput({ type: 'output', content: line });
        });
      }

      if (result.stderr.trim()) {
        result.stderr.trim().split('\n').forEach(line => {
          addOutput({ type: 'error', content: line });
        });
      }

      if (result.code !== 0 && !result.stderr.trim()) {
        addOutput({ type: 'error', content: 'Command exited with code ' + result.code });
      }
    } catch (error) {
      setOutput(prev => prev.filter(line => line.type !== 'running'));
      addOutput({ type: 'error', content: error.message });
    } finally {
      setIsRunning(false);
    }
  }, [addOutput, exit, servers, groups, instances, runCliCommand]);

  // Handle submit
  const handleSubmit = useCallback((value) => {
    if (!value.trim() || isRunning) return;

    setShowHelp(false);

    const newHistory = [value, ...history.filter(h => h !== value)].slice(0, MAX_HISTORY);
    setHistory(newHistory);
    saveHistory(newHistory);
    setHistoryIndex(-1);

    executeCommand(value);

    setInput('');
    setSuggestions([]);
  }, [history, isRunning, executeCommand]);

  // Handle input key events
  useInput((inputChar, key) => {
    if (isRunning) return;

    if (key.tab && suggestions.length > 0) {
      const selected = suggestions[selectedSuggestion];
      if (selected) {
        setInput(selected.name + ' ');
        setSuggestions([]);
      }
      return;
    }

    if (key.upArrow) {
      if (suggestions.length > 0) {
        setSelectedSuggestion(prev => Math.max(0, prev - 1));
      } else if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex] || '');
      }
      return;
    }

    if (key.downArrow) {
      if (suggestions.length > 0) {
        setSelectedSuggestion(prev => Math.min(suggestions.length - 1, prev + 1));
      } else if (historyIndex > -1) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(newIndex >= 0 ? history[newIndex] : '');
      }
      return;
    }

    if (key.escape) {
      setSuggestions([]);
      setShowHelp(false);
      return;
    }

    if (key.ctrl && inputChar === 'c') {
      exit();
      return;
    }
  });

  // Check for raw mode support
  if (!isRawModeSupported) {
    return h(Box, { flexDirection: 'column', padding: 1 },
      h(Text, { color: 'red' }, 'Interactive mode requires a TTY terminal with raw mode support.'),
      h(Text, { color: 'yellow' }, 'Please run in a proper terminal environment.')
    );
  }

  return h(Box, { flexDirection: 'column', height: '100%' },
    // Header
    h(Box, { paddingX: 1, marginBottom: 1 },
      h(Text, { color: 'green', bold: true }, 'mcpz Interactive Mode'),
      h(Text, { color: 'gray' }, ' (Ctrl+C to exit)')
    ),

    // Status Bar
    h(StatusBar, { instances, servers, groups }),

    // Running Instances
    h(RunningInstances, { instances }),

    // Help Panel (conditional)
    showHelp && h(HelpPanel),

    // Output Area
    h(Box, { flexDirection: 'column', flexGrow: 1, paddingX: 1, marginY: 1 },
      ...output.slice(-20).map((line, idx) =>
        h(OutputLine, { key: idx, line })
      )
    ),

    // Autocomplete Suggestions
    h(AutocompleteSuggestions, { suggestions, selectedIndex: selectedSuggestion }),

    // Input Box
    h(Box, { borderStyle: 'double', borderColor: 'blue', paddingX: 1 },
      h(Text, { color: 'green' }, '> '),
      h(TextInput, {
        value: input,
        onChange: setInput,
        onSubmit: handleSubmit,
        placeholder: 'Type a command (Tab for autocomplete)...'
      })
    )
  );
}

// Export the interactive function
export async function interactive() {
  try {
    if (!process.stdin.isTTY) {
      console.error('Interactive mode requires a TTY terminal.');
      console.error('Please run in a terminal with TTY support.');
      process.exit(1);
    }

    const { waitUntilExit } = render(h(InteractiveApp));

    await waitUntilExit();
  } catch (error) {
    console.error('Error starting interactive mode:', error.message);
    process.exit(1);
  }
}
