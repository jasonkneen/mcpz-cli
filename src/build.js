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
    // Skip obfuscation for all files now - directly copy files
    const content = await fs.readFile(filePath, 'utf8');
    
    const targetPath = path.join(distDir, relativePath);
    const targetDir = path.dirname(targetPath);
    
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetPath, content);
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
  
  if (pkg.bin) {
    Object.keys(pkg.bin).forEach(key => {
      pkg.bin[key] = './index.js';
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
  
  // Change files array to include everything
  pkg.files = ['.'];
  
  // Add explicit dependencies to ensure utils directory is included
  if (!pkg.dependencies) {
    pkg.dependencies = {};
  }
  
  // Hide source code from npm website
  pkg.repository = {
    type: 'git',
    url: 'git+https://github.com/jasonkneen/mcpz.git',
    directory: 'dist'
  };
  
  await fs.writeFile(
    path.join(distDir, 'package.json'),
    JSON.stringify(pkg, null, 2)
  );
  console.info('Updated package.json');
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
    
    // Copy all utils files
    const utilFiles = await fs.readdir(srcUtilsDir);
    for (const file of utilFiles) {
      if (file.endsWith('.js')) {
        const srcPath = path.join(srcUtilsDir, file);
        const destPath = path.join(distUtilsDir, file);
        await fs.copyFile(srcPath, destPath);
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
    // Clear dist directory if it exists
    try {
      await fs.rm(distDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's OK
    }
    
    // Create dist directory
    await fs.mkdir(distDir, { recursive: true });
    
    // Process all files
    await processDirectory(srcDir);
    
    // Ensure utils directory exists and files are copied
    // This needs to run after processDirectory to ensure our
    // non-obfuscated utils files replace any obfuscated ones
    await copyUtilsDirectory();
    
    // Create updated package.json in dist
    await copyPackageJson();
    
    // Copy additional files to dist
    await copyReadme();
    await copyBanner();
    
    console.info('Build completed successfully!');
  } catch (error) {
    console.info('Build failed:', error);
    process.exit(1);
  }
}

main();