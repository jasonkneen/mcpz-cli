#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import JavaScriptObfuscator from 'javascript-obfuscator';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.resolve(rootDir, 'src');
const distDir = path.resolve(rootDir, 'dist');

// Obfuscation options - adjust as needed
const obfuscationOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: true,
  shuffleStringArray: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

async function copyAndObfuscateFile(filePath, relativePath) {
  try {
    // Read the file content
    const content = await fs.readFile(filePath, 'utf8');
    
    // Obfuscate JavaScript files
    let processedContent = content;
    if (filePath.endsWith('.js')) {
      try {
        const obfuscationResult = JavaScriptObfuscator.obfuscate(content, obfuscationOptions);
        processedContent = obfuscationResult.getObfuscatedCode();
      } catch (obfuscationError) {
        console.info(`Warning: Could not obfuscate ${filePath}, using original content: ${obfuscationError.message}`);
      }
    }
    
    const targetPath = path.join(distDir, relativePath);
    const targetDir = path.dirname(targetPath);
    
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetPath, processedContent);
    console.info(`Copied: ${relativePath}`);
  } catch (error) {
    console.info(`Error processing ${filePath}:`, error);
  }
}

async function copyPackageJson() {

  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
  
  // Update paths to point to dist
  pkg.main = 'index.js';
  
  // Remove scripts from dist package.json - they're not needed there
  delete pkg.scripts;
  delete pkg.husky;
  delete pkg['lint-staged'];
  
  if (pkg.bin) {
    Object.keys(pkg.bin).forEach(key => {
      pkg.bin[key] = 'index.js';  // Remove ./ to ensure proper resolution
    });
  }
  
  // Make the bin files executable
  await fs.chmod(path.join(distDir, 'index.js'), 0o755);
  
  // Add shebang to the index.js file if not already there
  const indexPath = path.join(distDir, 'index.js');
  const content = await fs.readFile(indexPath, 'utf8');
  if (!content.startsWith('#!/usr/bin/env node')) {
    await fs.writeFile(indexPath, '#!/usr/bin/env node\n' + content);
  }
  
  // Ensure we include all necessary files
  pkg.files = ['index.js', 'utils', 'commands', 'server.js', 'banner.js'];
  
  // Add exports field to ensure utils directory is correctly importable
  pkg.exports = {
    '.': './index.js',
    './utils/*': './utils/*.js',
    './commands/*': './commands/*.js'
  };
  
  // Keep only runtime dependencies
  if (!pkg.dependencies) {
    pkg.dependencies = {};
  }
  
  // Remove all dev dependencies
  delete pkg.devDependencies;
  
  // Update repository info
  pkg.repository = {
    type: 'git',
    url: 'git+https://github.com/jasonkneen/mcpz.git'
  };
  
  // Set important flags to match the name of the package
  if (pkg.name === '@mcpz/cli') {
    // This ensures the installation works as expected
    pkg.name = '@mcpz/cli';
  }
  
  await fs.writeFile(
    path.join(distDir, 'package.json'),
    JSON.stringify(pkg, null, 2)
  );
  console.info('Updated package.json');
  
  // Create @mcpz/package.json just in case for backward compatibility
  // This helps with the error when the CLI tries to load @mcpz/package.json
  try {
    const mcpzDir = path.join(distDir, '..', 'node_modules', '@mcpz');
    await fs.mkdir(mcpzDir, { recursive: true });
    await fs.writeFile(
      path.join(mcpzDir, 'package.json'),
      JSON.stringify({ name: '@mcpz', version: pkg.version }, null, 2)
    );
    console.info('Created backward compatibility package.json');
  } catch (error) {
    console.info('Warning: Could not create backward compatibility package.json:', error.message);
  }
}

async function processDirectory(directory, baseDir = srcDir) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (entry.isDirectory()) {
      await processDirectory(fullPath, baseDir);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      await copyAndObfuscateFile(fullPath, relativePath);
    }
  }
}

async function copyReadme() {
  const readmePath = path.join(rootDir, 'README.md');
  const distReadmePath = path.join(distDir, 'README.md');
  
  try {
    await fs.copyFile(readmePath, distReadmePath);
    console.info('Copied README.md to dist');
  } catch (error) {
    console.info('Error copying README.md:', error);
  }
}

async function copyBanner() {
  const bannerPath = path.join(rootDir, 'banner.js');
  const distBannerPath = path.join(distDir, 'banner.js');
  
  try {
    await fs.copyFile(bannerPath, distBannerPath);
    console.info('Copied banner.js to dist');
    
    // Also make sure it's at the root level for the code directly
    const distRootBannerPath = path.join(distDir, 'banner.js');
    if (distRootBannerPath !== distBannerPath) {
      await fs.copyFile(bannerPath, distRootBannerPath);
      console.info('Also copied banner.js to dist root');
    }
  } catch (error) {
    console.info('Error copying banner.js:', error);
  }
}

async function copyUtilsDirectory() {
  // Make sure the utils directory exists in dist
  const srcUtilsDir = path.join(srcDir, 'utils');
  const distUtilsDir = path.join(distDir, 'utils');
  
  try {
    await fs.mkdir(distUtilsDir, { recursive: true });
    
    // Copy all utils files with obfuscation
    const utilFiles = await fs.readdir(srcUtilsDir);
    for (const file of utilFiles) {
      if (file.endsWith('.js')) {
        const srcPath = path.join(srcUtilsDir, file);
        const destPath = path.join(distUtilsDir, file);
        
        // Read, obfuscate, and write the file
        const content = await fs.readFile(srcPath, 'utf8');
        let processedContent = content;
        
        try {
          const obfuscationResult = JavaScriptObfuscator.obfuscate(content, obfuscationOptions);
          processedContent = obfuscationResult.getObfuscatedCode();
          console.info(`Obfuscated utils/${file} for dist`);
        } catch (obfuscationError) {
          console.info(`Warning: Could not obfuscate utils/${file}, using original content: ${obfuscationError.message}`);
        }
        
        await fs.writeFile(destPath, processedContent);
        console.info(`Copied utils/${file} to dist`);
      }
    }
    
    console.info('Created and populated utils directory in dist');
  } catch (error) {
    console.info('Error processing utils directory:', error);
  }
}

async function main() {
  try {
    console.info('Starting build with obfuscation enabled...');
    
    // Clear dist directory if it exists
    try {
      await fs.rm(distDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's OK
    }
    
    // Create dist directory
    await fs.mkdir(distDir, { recursive: true });
    
    // Process all files
    console.info('Processing source files with obfuscation...');
    await processDirectory(srcDir);
    
    // Ensure utils directory exists and files are copied with obfuscation
    console.info('Processing utils directory with obfuscation...');
    await copyUtilsDirectory();
    
    // Create updated package.json in dist
    console.info('Updating package.json to include utils...');
    await copyPackageJson();
    
    // Copy additional files to dist
    await copyReadme();
    await copyBanner();
    
    // Verify dist structure
    console.info('Verifying dist directory structure...');
    const distFiles = await fs.readdir(distDir, { withFileTypes: true });
    console.info('Dist directory contents:', distFiles.map(f => f.name).join(', '));
    
    // Specifically check for utils directory
    const hasUtils = distFiles.some(f => f.name === 'utils' && f.isDirectory());
    if (hasUtils) {
      console.info('Utils directory correctly included in dist');
      const utilsFiles = await fs.readdir(path.join(distDir, 'utils'));
      console.info('Utils files:', utilsFiles.join(', '));
    } else {
      console.info('WARNING: Utils directory not found in dist!');
    }
    
    console.info('Build completed successfully with obfuscation!');
  } catch (error) {
    console.info('Build failed:', error);
    process.exit(1);
  }
}

main();