// Import necessary modules
import chalk from 'chalk';
import boxen from 'boxen';
import { spawn } from 'child_process';
import { InstanceManager } from '../utils/instanceManager.js';
import { readConfig } from '../utils/config.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import logUpdate from 'log-update';
import termSize from 'term-size';

// Dynamic path resolution for current script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const binPath = path.resolve(__dirname, '../../dist/index.js');

// Command history management
const MAX_HISTORY = 50;
const historyFile = path.join(process.env.HOME || process.env.USERPROFILE, '.mcpz_history');

// Terminal size
const { columns, rows } = termSize();

// Define UI elements
const PROMPT = chalk.green('> ');
const DIVIDER = '─'.repeat(columns);
const INPUT_BOX_HEIGHT = 3;

// UI state
let inputValue = '';
let commandHistory = [];
let historyIndex = -1;
let output = [];
let isRunning = false;
let mcps = [];
let instances = [];

/**
 * Renders the status bar with instance information
 */
function renderStatusBar() {
  const runningCount = instances.filter(i => i.status === 'running').length;
  
  return boxen(
    `${chalk.green('Running Servers:')} ${chalk.yellow(runningCount)} | ${chalk.green('MCPs Installed:')} ${chalk.yellow(mcps.length)}`,
    {
      padding: 0,
      margin: 0,
      borderStyle: 'round',
      borderColor: 'gray',
      dimBorder: true,
      width: columns - 4
    }
  );
}

/**
 * Renders the command output
 */
function renderOutput() {
  const outputHeight = rows - INPUT_BOX_HEIGHT - 6; // Reserve space for status bar and headers
  const visibleOutput = output.slice(-outputHeight);
  
  return visibleOutput.map(item => {
    if (item.type === 'command') {
      return chalk.cyan(`> ${item.content}`);
    } else if (item.type === 'running') {
      return chalk.yellow('Running...');
    } else if (item.type === 'error') {
      return chalk.red(item.content);
    } else {
      return item.content;
    }
  }).join('\n');
}

/**
 * Renders the input box
 */
function renderInputBox() {
  return boxen(
    `${PROMPT}${inputValue}`,
    {
      padding: 0,
      margin: {
        top: 1,
        bottom: 0
      },
      borderStyle: 'single',
      borderColor: 'blue',
      width: columns - 4
    }
  );
}

/**
 * Renders the entire UI
 */
function renderUI() {
  const header = chalk.green.bold('mcpz Interactive Mode (Ctrl+C or type exit to quit)');
  const headerLine = chalk.dim('─'.repeat(columns));
  
  const statusBar = renderStatusBar();
  const outputArea = renderOutput();
  const inputBox = renderInputBox();
  
  logUpdate(
    `${header}\n${headerLine}\n${statusBar}\n\n${outputArea}\n\n${inputBox}`
  );
}

/**
 * Execute command using the CLI binary
 */
async function executeCommand(command) {
  return new Promise((resolve, reject) => {
    const args = command.split(' ');
    const childProcess = spawn('node', [binPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';
    
    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    childProcess.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });
    
    childProcess.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Handle command execution
 */
async function handleCommand(command) {
  // Add command to output
  output.push({ type: 'command', content: command });
  isRunning = true;
  output.push({ type: 'running' });
  renderUI();
  
  try {
    // Add to history
    addToHistory(command);
    
    const { stdout, stderr, code } = await executeCommand(command);
    
    // Remove running indicator
    output = output.filter(item => item.type !== 'running');
    
    // Add command output
    if (stdout.trim()) {
      output.push({ type: 'output', content: stdout.trim() });
    }
    
    if (stderr.trim()) {
      output.push({ type: 'error', content: stderr.trim() });
    }
    
    if (code !== 0 && !stderr.trim()) {
      output.push({ type: 'error', content: `Command exited with code ${code}` });
    }
  } catch (error) {
    output = output.filter(item => item.type !== 'running');
    output.push({ type: 'error', content: error.message });
  } finally {
    isRunning = false;
    renderUI();
  }
}

/**
 * Load command history
 */
function loadHistory() {
  try {
    if (fs.existsSync(historyFile)) {
      const historyData = fs.readFileSync(historyFile, 'utf-8');
      commandHistory = historyData.split('\n').filter(Boolean);
    }
  } catch (error) {
    // Silently fail
  }
}

/**
 * Save command to history
 */
function addToHistory(cmd) {
  if (!cmd.trim()) return;
  
  commandHistory = [cmd, ...commandHistory.filter(item => item !== cmd)].slice(0, MAX_HISTORY);
  historyIndex = -1;
  
  try {
    fs.writeFileSync(historyFile, commandHistory.join('\n'));
  } catch (error) {
    // Silently fail
  }
}

/**
 * Handle keyboard input
 */
function setupKeyboardHandling() {
  // Use readline/promises from Node.js core modules instead of require
  import('readline').then(({ createInterface }) => {
    // Create a readline interface for stdin/stdout
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '',
      terminal: true
    });
    
    // Handle line input (Enter key)
    rl.on('line', (line) => {
      if (line.trim() === 'exit' || line.trim() === 'quit') {
        process.exit(0);
      }
      
      if (line.trim() && !isRunning) {
        handleCommand(line.trim());
        inputValue = '';
        renderUI();
      }
    });
    
    // Simple handling for Ctrl+C
    rl.on('SIGINT', () => {
      process.exit(0);
    });
    
    // This is a simplified version without all the advanced keyboard handling
    // For a more advanced version, we'd need to implement raw mode handling
    console.log(chalk.yellow('Note: Full keyboard navigation (arrows, etc.) requires the full terminal interface'));
  }).catch(error => {
    console.error(`Error setting up keyboard handling: ${error.message}`);
  });
}

/**
 * Load MCP configurations and instances
 */
function setupInstanceTracking() {
  // Load MCP configurations
  const config = readConfig();
  mcps = config.servers || [];
  
  // Set up instance tracking
  const instanceManager = InstanceManager.getInstance();
  instances = instanceManager.getAllInstances();
  
  instanceManager.on('instances_changed', (updatedInstances) => {
    instances = updatedInstances;
    renderUI();
  });
}

/**
 * Start the interactive CLI
 */
export async function interactive() {
  // Display welcome message
  console.log(
    boxen(chalk.green('Starting mcpz interactive mode...'), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
    })
  );
  
  // Clear console
  console.clear();
  
  // Initialize
  loadHistory();
  setupInstanceTracking();
  setupKeyboardHandling();
  
  // Initial render
  renderUI();
}