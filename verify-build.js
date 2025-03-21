#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyBuild() {
  console.log('Starting build verification...');
  
  try {
    // Run the build script
    console.log('Running build script...');
    execSync('node src/build.js', { stdio: 'inherit' });
    
    // Check if dist directory exists
    console.log('\nVerifying dist directory structure:');
    const distPath = path.join(__dirname, 'dist');
    
    try {
      await fs.access(distPath);
      console.log('✅ dist directory exists');
    } catch (error) {
      console.error('❌ dist directory does not exist!');
      process.exit(1);
    }
    
    // Check for key files
    const requiredFiles = [
      'index.js',
      'package.json'
    ];
    
    for (const file of requiredFiles) {
      try {
        await fs.access(path.join(distPath, file));
        console.log(`✅ ${file} exists`);
      } catch (error) {
        console.error(`❌ ${file} is missing!`);
        process.exit(1);
      }
    }
    
    // Check for utils directory
    const utilsPath = path.join(distPath, 'utils');
    try {
      await fs.access(utilsPath);
      console.log('✅ utils directory exists');
      
      // List utils files
      const utilsFiles = await fs.readdir(utilsPath);
      console.log(`✅ utils directory contains: ${utilsFiles.join(', ')}`);
      
      if (utilsFiles.length === 0) {
        console.error('❌ utils directory is empty!');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ utils directory is missing!');
      process.exit(1);
    }
    
    // Check for commands directory
    const commandsPath = path.join(distPath, 'commands');
    try {
      await fs.access(commandsPath);
      console.log('✅ commands directory exists');
      
      // List commands files
      const commandsFiles = await fs.readdir(commandsPath);
      console.log(`✅ commands directory contains: ${commandsFiles.join(', ')}`);
      
      if (commandsFiles.length === 0) {
        console.error('❌ commands directory is empty!');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ commands directory is missing!');
      process.exit(1);
    }
    
    // Check package.json configuration
    const packageJson = JSON.parse(await fs.readFile(path.join(distPath, 'package.json'), 'utf8'));
    
    // Check files array for utils
    if (!packageJson.files || !packageJson.files.includes('./utils')) {
      console.error('❌ package.json files array does not include "./utils"!');
      process.exit(1);
    } else {
      console.log('✅ package.json files array includes "./utils"');
    }
    
    // Check files array for commands
    if (!packageJson.files || !packageJson.files.includes('./commands')) {
      console.error('❌ package.json files array does not include "./commands"!');
      process.exit(1);
    } else {
      console.log('✅ package.json files array includes "./commands"');
    }
    
    // Check exports configuration for utils
    if (!packageJson.exports || !packageJson.exports['./utils/*']) {
      console.error('❌ package.json exports configuration for utils is missing or incorrect!');
      process.exit(1);
    } else {
      console.log('✅ package.json exports for utils is correctly configured');
    }
    
    // Check exports configuration for commands
    if (!packageJson.exports || !packageJson.exports['./commands/*']) {
      console.error('❌ package.json exports configuration for commands is missing or incorrect!');
      process.exit(1);
    } else {
      console.log('✅ package.json exports for commands is correctly configured');
    }
    
    console.log('\nBuild verification completed successfully! ✨');
    
    // Optional: Test pack the module
    console.log('\nCreating test npm package (dry run)...');
    execSync('npm pack --dry-run', { stdio: 'inherit' });
    
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verifyBuild();