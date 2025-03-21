#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Display the main package.json scripts
const mainPkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));



// Change to dist directory

process.chdir('./dist');

// Display the dist package.json
const distPkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));



// Check if scripts section exists
if (distPkg.scripts) {


} else {

}