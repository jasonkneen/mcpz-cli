// Import necessary modules
import chalk from 'chalk';
import boxen from 'boxen';
import { spawn } from 'child_process';
import { InstanceManager } from '../utils/instanceManager.js';
import { readConfig } from '../utils/config.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import logUpdate from 'log-update';
import termSize from 'term-size';

// Dynamic path resolution for current script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const binPath = path.resolve(__dirname, '../../dist/index.js');

// Command history management
const MAX_HISTORY = 50;
const homedir = process.env.HOME || process.env.USERPROFILE || os.homedir();
const historyFile = path.join(homedir, '.mcpz_history');

// Terminal size
const { columns, rows } = termSize();

// Define UI elements
const PROMPT = chalk.green('> ');
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
  const errorCount = instances.filter(i => i.status === 'error').length;
  
  // Calculate total memory usage
  const totalMemory = instances
    .filter(i => i.status === 'running' && i.resourceUsage && i.resourceUsage.memory)
    .reduce((sum, i) => {
      const memory = parseFloat(i.resourceUsage.memory);
      return isNaN(memory) ? sum : sum + memory;
    }, 0);
  
  // Format memory display
  const memoryDisplay = totalMemory > 0 
    ? `${chalk.magenta('Memory:')} ${chalk.white(totalMemory.toFixed(1) + ' MB')}` 
    : '';
  
  // Show server type counts
  const serverTypes = instances
    .filter(i => i.status === 'running' && i.displayInfo && i.displayInfo.type)
    .reduce((types, i) => {
      const type = i.displayInfo.type;
      if (!types[type]) types[type] = 0;
      types[type]++;
      return types;
    }, {});
  
  const typeDisplay = Object.entries(serverTypes)
    .map(([type, count]) => `${chalk.cyan(type)}: ${chalk.white(count)}`)
    .join(' ');
  
  // Construct the full status bar content with spacing
  const content = [
    `${chalk.green('Running:')} ${chalk.yellow(runningCount)}`,
    errorCount > 0 ? `${chalk.red('Errors:')} ${chalk.yellow(errorCount)}` : '',
    `${chalk.green('Total MCPs:')} ${chalk.yellow(mcps.length)}`,
    memoryDisplay,
    typeDisplay
  ].filter(Boolean).join(' │ ');
  
  return boxen(content, {
    padding: {
      left: 1,
      right: 1,
      top: 0,
      bottom: 0
    },
    margin: 0,
    borderStyle: 'round',
    borderColor: 'cyan',
    dimBorder: false,
    width: columns - 4
  });
}

/**
 * Renders detailed instance information
 */
function renderInstanceDetails() {
  const runningInstances = instances.filter(i => i.status === 'running');
  if (runningInstances.length === 0) return '';
  
  const instanceDetails = runningInstances.map(instance => {
    // Format basic instance info
    const pid = instance.pid ? chalk.yellow(`PID: ${instance.pid}`) : chalk.gray('PID: pending');
    const name = chalk.green(instance.serverName);
    const uptime = getUptime(instance.startTime);
    
    // Format resource usage if available
    let resourceInfo = '';
    if (instance.resourceUsage) {
      const { memory, cpu, uptime: processUptime } = instance.resourceUsage;
      const resourceParts = [];
      
      if (memory) resourceParts.push(`${chalk.magenta('Mem:')} ${chalk.white(memory)}`);
      if (cpu) resourceParts.push(`${chalk.blue('CPU:')} ${chalk.white(cpu)}`);
      if (processUptime) resourceParts.push(`${chalk.cyan('Time:')} ${chalk.white(processUptime)}`);
      
      resourceInfo = resourceParts.length > 0 ? `[${resourceParts.join(' ')}]` : '';
    }
    
    // Format tool info if available
    let toolInfo = '';
    if (instance.mcpDetails && instance.mcpDetails.toolCount) {
      toolInfo = `${chalk.cyan('Tools:')} ${chalk.white(instance.mcpDetails.toolCount)}`;
    }
    
    // Format filters if available
    let filterInfo = '';
    if (instance.displayInfo && instance.displayInfo.filters) {
      const { tools, servers, groups } = instance.displayInfo.filters;
      const filterParts = [];
      
      if (tools && tools.length) filterParts.push(`tools:${tools.join(',')}`);
      if (servers && servers.length) filterParts.push(`servers:${servers.join(',')}`);
      if (groups && groups.length) filterParts.push(`groups:${groups.join(',')}`);
      
      if (filterParts.length > 0) {
        filterInfo = `${chalk.yellow('Filters:')} ${chalk.gray(filterParts.join(' '))}`;
      }
    }
    
    // Combine all parts
    return [
      `${name} ${pid} ${chalk.gray(`(${uptime})`)}`,
      resourceInfo,
      toolInfo,
      filterInfo
    ].filter(Boolean).join(' ');
  });
  
  return boxen(
    instanceDetails.join('\n'),
    {
      title: chalk.bold('Running Instances'),
      padding: 1,
      margin: {
        top: 1,
        bottom: 1
      },
      borderStyle: 'round',
      borderColor: 'green',
      width: columns - 4
    }
  );
}

/**
 * Formats uptime in a human-readable way
 */
function getUptime(startTime) {
  const uptime = Date.now() - startTime;
  const seconds = Math.floor(uptime / 1000);
  
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
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
  // Add a cursor marker to show where input will appear
  const cursorChar = '█';
  const visibleInput = `${PROMPT}${inputValue}${chalk.cyan.bold(cursorChar)}`;
  
  return boxen(
    visibleInput,
    {
      padding: {
        left: 1,
        right: 1,
        top: 0,
        bottom: 0
      },
      margin: {
        top: 1,
        bottom: 0
      },
      borderStyle: 'double',
      borderColor: 'blue',
      width: columns - 4
      // Remove float: 'bottom' which was causing rendering issues
    }
  );
}

/**
 * Renders the welcome panel with helpful info
 */
function renderWelcomePanel() {
  return boxen(
    `${chalk.green.bold('Welcome to mcpz!')}\n\n` +
    `${chalk.yellow('Type')} ${chalk.cyan('/help')} ${chalk.yellow('for command help')}\n` +
    `${chalk.dim(`Current working directory: ${process.cwd()}`)}`,
    {
      padding: 1,
      margin: {
        top: 0,
        bottom: 1
      },
      borderStyle: 'round',
      borderColor: 'green',
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
  const instanceDetails = renderInstanceDetails();
  const welcomePanel = renderWelcomePanel();
  const outputArea = renderOutput();
  const inputBox = renderInputBox();
  
  // Calculate available height for the output area
  const instanceDetailsHeight = instanceDetails ? instanceDetails.split('\n').length : 0;
  const outputHeight = Math.max(
    1, 
    rows - INPUT_BOX_HEIGHT - 6 - instanceDetailsHeight - welcomePanel.split('\n').length
  );
  
  // Adjust visible output based on available height
  const visibleOutput = outputArea.split('\n').slice(-outputHeight).join('\n');
  
  // Clear the screen first to ensure clean rendering
  process.stdout.write('\x1B[2J\x1B[0f');
  
  // Use console.log for output area to preserve ASCII art
  console.clear();
  console.log(
    [
      header,
      headerLine,
      statusBar,
      instanceDetails, // Add the detailed instance panel
      welcomePanel,
      visibleOutput
    ].filter(Boolean).join('\n')
  );
  
  // Use logUpdate only for the input box to prevent flickering
  logUpdate(inputBox);
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
  try {
    // Check if we're in a TTY environment that supports raw mode
    if (!process.stdin.isTTY) {
      console.error('Interactive mode requires a TTY environment. Please run in a terminal.');
      process.exit(1);
    }
    
    // Enter raw mode to capture keystrokes directly
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    // Buffer for escape sequences
    let escapeBuffer = '';
    let escapeTimeout;
    
    // Handle keystroke input
    process.stdin.on('data', (key) => {
      // Handle escape sequences
      if (escapeBuffer.length > 0) {
        escapeBuffer += key;
        clearTimeout(escapeTimeout);
        
        // Process known escape sequences
        if (escapeBuffer === '\u001b[A') { // Up arrow
          if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
            historyIndex++;
            inputValue = commandHistory[historyIndex];
          }
          escapeBuffer = '';
        } else if (escapeBuffer === '\u001b[B') { // Down arrow
          if (historyIndex > 0) {
            historyIndex--;
            inputValue = commandHistory[historyIndex];
          } else if (historyIndex === 0) {
            historyIndex = -1;
            inputValue = '';
          }
          escapeBuffer = '';
        } else if (escapeBuffer === '\u001b[C') { // Right arrow
          // Cursor movement logic if needed
          escapeBuffer = '';
        } else if (escapeBuffer === '\u001b[D') { // Left arrow
          // Cursor movement logic if needed
          escapeBuffer = '';
        } else if (escapeBuffer.length >= 3) {
          // Unknown escape sequence, discard
          escapeBuffer = '';
        } else {
          // Wait for more characters
          escapeTimeout = setTimeout(() => {
            escapeBuffer = '';
          }, 50);
          return;
        }
      } else if (key === '\u001b') { // Escape
        escapeBuffer = key;
        escapeTimeout = setTimeout(() => {
          escapeBuffer = '';
        }, 50);
        return;
      }
      
      // Handle standard keys
      if (key === '\u0003') { // Ctrl+C
        process.exit(0);
      } else if (key === '\r' || key === '\n') { // Enter
        if (inputValue.trim() === 'exit' || inputValue.trim() === 'quit') {
          process.exit(0);
        }
        
        if (inputValue.trim() && !isRunning) {
          handleCommand(inputValue.trim());
          inputValue = '';
        }
      } else if (key === '\u007f') { // Backspace
        inputValue = inputValue.slice(0, -1);
      } else if (key.charCodeAt(0) >= 32 && key.charCodeAt(0) <= 126) { // Printable characters
        inputValue += key;
      }
      
      renderUI();
    });
    
    // Set up cleanup
    process.on('SIGINT', () => {
      process.exit(0);
    });
    
    process.on('exit', () => {
      // Reset terminal settings
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
        process.stdout.write('\x1B[?25h'); // Show cursor
      }
    });
  } catch (error) {
    console.error(`Error setting up keyboard handling: ${error.message}`);
    console.error('Interactive mode not available in this environment. Try using regular commands instead.');
    process.exit(1);
  }
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
  try {
    // Check if interactive mode is disabled
    console.log(
      boxen(chalk.yellow('Interactive mode is currently disabled.'), {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'red',
      })
    );
    process.exit(0);
    
    // The code below will not execute unless the early exit is removed
    
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
  } catch (error) {
    console.error(chalk.red(`Error starting interactive mode: ${error.message}`));
    console.error(chalk.yellow('Interactive mode is only available in a terminal environment.'));
    process.exit(1);
  }
}