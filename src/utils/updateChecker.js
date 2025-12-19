import { execFile } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const execFilePromise = promisify(execFile);
const require = createRequire(import.meta.url);

// Security: Validate package name to prevent command injection
function validatePackageName(name) {
  // npm package names: lowercase, can contain dots, hyphens, underscores, @scope
  const validPattern = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
  if (!name || typeof name !== 'string') return false;
  if (name.length > 214) return false;
  return validPattern.test(name);
}

// Get the current directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to find package.json in different possible locations
let packageJson;
try {
  // First try to load from parent directory (during development)
  packageJson = require('../../package.json');
} catch (error) {
  try {
    // Then try from the current directory's parent (in production/npm package)
    packageJson = require(path.join(__dirname, '../package.json'));
  } catch (innerError) {
    try {
      // As a last resort, try to read it directly from the filesystem
      const packagePath = path.join(__dirname, '../package.json');
      const packageData = fs.readFileSync(packagePath, 'utf8');
      packageJson = JSON.parse(packageData);
    } catch (finalError) {
      // Create a minimal package.json with just enough info to not break
      packageJson = {
        name: '@mcpz/cli',
        version: '1.0.28'  // Hardcoded fallback
      };
      console.log('Warning: Could not find package.json, using fallback values');
    }
  }
}

/**
 * Check if a newer version of the package is available
 * @returns {Promise<{hasUpdate: boolean, currentVersion: string, latestVersion: string}>}
 */
export async function checkForUpdates() {
  try {
    // Security: Validate package name before use
    if (!validatePackageName(packageJson.name)) {
      throw new Error('Invalid package name');
    }

    // Security: Use execFile with explicit arguments (no shell) and timeout
    const { stdout } = await execFilePromise('npm', ['view', packageJson.name, 'version'], {
      timeout: 2000, // 2 second timeout
      maxBuffer: 1024 * 10 // 10KB max
    });
    const latestVersion = stdout.trim();
    const currentVersion = packageJson.version;
    
    // Compare versions
    const hasUpdate = compareVersions(currentVersion, latestVersion) < 0;
    
    return {
      hasUpdate,
      currentVersion,
      latestVersion
    };
  } catch (error) {
    console.error('Error checking for updates:', error.message);
    return {
      hasUpdate: false,
      currentVersion: packageJson.version,
      latestVersion: null,
      error: error.message
    };
  }
}

/**
 * Install the latest version of the package
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function updatePackage() {
  try {
    // Security: Validate package name before use
    if (!validatePackageName(packageJson.name)) {
      throw new Error('Invalid package name');
    }

    console.log('Updating to the latest version...');
    // Security: Use execFile with explicit arguments (no shell) and timeout
    const { stdout, stderr } = await execFilePromise('npm', ['install', '-g', `${packageJson.name}@latest`], {
      timeout: 60000, // 60 second timeout for install
      maxBuffer: 1024 * 1024 // 1MB max for install output
    });
    
    if (stderr && !stderr.includes('npm WARN')) {
      throw new Error(stderr);
    }
    
    return {
      success: true,
      message: 'Successfully updated to the latest version!'
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to update: ${error.message}`
    };
  }
}

/**
 * Compare two version strings
 * @param {string} versionA 
 * @param {string} versionB 
 * @returns {number} -1 if versionA is older, 0 if equal, 1 if versionA is newer
 */
function compareVersions(versionA, versionB) {
  const partsA = versionA.split('.').map(Number);
  const partsB = versionB.split('.').map(Number);
  
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i] || 0;
    const partB = partsB[i] || 0;
    
    if (partA < partB) return -1;
    if (partA > partB) return 1;
  }
  
  return 0;
}

/**
 * Run the update check and prompt the user to update if needed
 * @param {boolean} silent - If true, won't print anything if no updates are available
 * @returns {Promise<void>}
 */
export async function checkAndPromptForUpdate(silent = false) {
  try {
    const { hasUpdate, currentVersion, latestVersion } = await checkForUpdates();
    
    if (hasUpdate) {
      console.log(`\nUpdate available: ${currentVersion} → ${latestVersion}`);
      
      // Use readline to prompt for update
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      readline.question('Would you like to update now? (y/n) ', async (answer) => {
        readline.close();
        
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          const result = await updatePackage();
          console.log(result.message);
          
          if (result.success) {
            console.log('Please restart your terminal to use the new version.');
          }
        } else {
          console.log('Update cancelled. You can update manually with:');
          console.log(`npm install -g ${packageJson.name}@latest`);
        }
      });
    } else if (!silent) {
      console.log(`You are using the latest version (${currentVersion}).`);
    }
  } catch (error) {
    if (!silent) {
      console.error('Error checking for updates:', error.message);
    }
  }
}

