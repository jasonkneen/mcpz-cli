#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isLogging } from './utils/config.js';
import { checkForUpdates } from './utils/updateChecker.js';
/**
 * Display the ASCII art banner
 */
function displayBanner() {
  try {
    // Get dirname and construct path to banner.js
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    
    // Try multiple possible locations for banner.js
    const possiblePaths = [
      path.join(__dirname, '../banner.js'),  // During development
      path.join(__dirname, './banner.js'),   // In production/npm package
      path.join(__dirname, 'banner.js'),     // Alternative production path
    ];
    
    let bannerContent = null;
    
    // Try each possible path
    for (const bannerPath of possiblePaths) {
      try {
        if (fs.existsSync(bannerPath)) {
          bannerContent = fs.readFileSync(bannerPath, 'utf8');
          break; // Found it, stop searching
        }
      } catch (e) {
        // Continue to next path
      }
    }
    
    // If we found the banner content
    if (bannerContent) {
      // Extract the ASCII art between /* and */
      const bannerMatch = bannerContent.match(/\/\*([\s\S]*?)\*\//m);

      if (bannerMatch && bannerMatch[1]) {
        // Display the banner
        console.log(bannerMatch[1]);
      }
    }
  } catch (error) {
    // Silently fail if banner can't be displayed
    if (isLogging()) {
      console.debug(`Error displaying banner: ${error.message}`);
    }
  }
}

// Display the banner
displayBanner();

// Import commands
import { add } from './commands/add.js';
import { remove } from './commands/remove.js';
import { list } from './commands/list.js';
import { use } from './commands/use.js';
import { tools } from './commands/tools.js';
import { help } from './commands/help.js';
import { config } from './commands/config.js';
import { registerUpdateCommand } from './commands/update.js';
// Get package version
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(__dirname, '../package.json');
const { version } = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Set up the program
program
  .name('mcps')
  .description('mcps command line interface')
  .version(version)
  .option('--debug', 'Enable debug mode');

// Register commands
program
  .command('run')
  .description('Start mcpz as a stdio server')
  .option('-s, --server <n>', 'Filter to load only a specific server')
  .option('-S, --servers <names>', 'Filter to load only specific servers (comma-separated)')
  .option('-t, --tool <n>', 'Filter to load only a specific tool')
  .option('-T, --tools <names>', 'Filter to load only specific tools (comma-separated)')
  .option('-g, --group <n>', 'Filter to load only servers in a specific group')
  .option('-G, --groups <names>', 'Filter to load only servers in specific groups (comma-separated)')
  .action((options) => {
    // Import server dynamically to avoid loading it unnecessarily
    import('./server.js').then(({ default: server }) => {
      server.start(options);
    }).catch(error => {
      console.info(chalk.red(`Error starting stdio server: ${error.message}`));
    });
  });

// Server group management commands
program
  .command('groups')
  .description('Manage MCP server and tool groups')
  .addCommand(
    new program.Command('add')
      .description('Create a new server group')
      .argument('<n>', 'Name of the group')
      .option('-s, --servers <servers>', 'Comma-separated list of server names to include in the group')
      .action((name, options) => {
        import('./commands/groups.js').then(({ addGroup }) => {
          addGroup(name, options);
        }).catch(error => {
          console.info(chalk.red(`Error adding group: ${error.message}`));
        });
      })
  )
  .addCommand(
    new program.Command('remove')
      .description('Remove a server group')
      .argument('<n>', 'Name of the group to remove')
      .action((name) => {
        import('./commands/groups.js').then(({ removeGroup }) => {
          removeGroup(name);
        }).catch(error => {
          console.info(chalk.red(`Error removing group: ${error.message}`));
        });
      })
  )
  .addCommand(
    new program.Command('list')
      .description('List all server groups')
      .action(() => {
        import('./commands/groups.js').then(({ listGroups }) => {
          listGroups();
        }).catch(error => {
          console.info(chalk.red(`Error listing groups: ${error.message}`));
        });
      })
  );

program
  .command('add')
  .description('Add a new MCP configuration')
  .argument('<n>', 'Name of the MCP')
  .option('-c, --command <command>', 'Command to run the MCP server')
  .option('-a, --args <args>', 'Arguments for the command (comma-separated)')
  .option('-e, --env <env>', 'Environment variables (key=value,key2=value2)')
  .action(add);

program
  .command('remove')
  .description('Remove an MCP configuration')
  .argument('<n>', 'Name of the MCP to remove')
  .action(remove);

program
  .command('list')
  .description('List MCP configurations')
  .action(list);

program
  .command('use')
  .description('Use a specific MCP configuration')
  .argument('<n>', 'Name of the MCP to use')
  .action(use);

program
  .command('tools')
  .description('List tools for MCP configurations')
  .option('-s, --server <server>', 'Filter tools by server name')
  .action((options) => {
    tools(options.server);
  });

program
  .command('help')
  .description('Display help information')
  .action(help);
  
program
  .command('config')
  .description('Manage CLI configuration')
  .option('-l, --load <path>', 'Custom path to load configuration from')
  .option('-s, --save <path>', 'Custom path to save configuration to')
  .action(config);

// Add help command
program.on('--help', () => {
  if (isLogging()) {
    console.info('');
    console.info('Usage:');
    console.info('  $ mcpz run [options]');
    console.info('  $ mcps run [options]');
    console.info('');
    console.info('Examples:');
    console.info('  $ mcpz run');
    console.info('  $ mcpz run --server="sleep"');
    console.info('  $ mcpz run --servers="python,pytorch" --tools="predict,generate"');
    console.info('  $ mcpz run --group="python-stack"');
    console.info('  $ mcpz run --groups="python-stack,ml-tools" --tools="predict"');
    console.info('  $ mcpz groups add "python-stack" --servers="python,pytorch,huggingface"');
    console.info('  $ mcpz run --servers="python-stack"');
    console.info('  $ mcpz tools');
    console.info('  $ mcpz tools --server="GPT Server"');
    console.info('  $ mcpz add "GPT Server" --command "node" --args "server.js"');
    console.info('  $ mcpz list');
  }
});

// Register update command
registerUpdateCommand(program);

// Check for updates quietly (only showing a message if an update is available)
checkForUpdates().then(({ hasUpdate, currentVersion, latestVersion }) => {
  if (hasUpdate) {
    console.log(chalk.yellow(`\nUpdate available: ${currentVersion} → ${latestVersion}`));
    console.log(chalk.white('Run \'mcpz update\' to install the latest version.'));
  }
}).catch(() => {
  // Silently ignore errors in update check
});

// Interactive mode command
program
  .command('interactive')
  .alias('i')
  .description('Start mcpz in interactive mode with a terminal user interface')
  .action(() => {
    import('./commands/interactive.js')
      .then(module => {
        module.interactive();
      })
      .catch(error => {
        console.error(chalk.red(`Error starting interactive mode: ${error.message}`));
      });
  });

// Parse arguments
program.parse(process.argv);

// Always show help if no arguments (we've disabled interactive mode as default)
if (process.argv.length === 2) {
  program.help();
}