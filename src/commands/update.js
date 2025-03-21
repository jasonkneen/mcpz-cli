import { Command } from 'commander';
import chalk from 'chalk';
import { checkForUpdates, updatePackage, checkAndPromptForUpdate } from '../utils/updateChecker.js';

export function registerUpdateCommand(program) {
  const updateCommand = new Command('update')
    .description('Check for updates and install the latest version')
    .option('-c, --check-only', 'Only check for updates without installing')
    .action(async (options) => {
      try {
        if (options.checkOnly) {
          // Just check for updates and report
          const { hasUpdate, currentVersion, latestVersion } = await checkForUpdates();
          
          if (hasUpdate) {
            console.log(chalk.yellow(`\nUpdate available: ${currentVersion} → ${latestVersion}`));
            console.log(chalk.white('Run \'mcpz update\' to install the latest version.'));
          } else {
            console.log(chalk.green(`You are using the latest version (${currentVersion}).`));
          }
        } else {
          // Check and prompt for update
          await checkAndPromptForUpdate();
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
    });
    
  program.addCommand(updateCommand);
  
  return updateCommand;
}

