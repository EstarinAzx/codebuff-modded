#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

// Wipe any stale binaries from a previous install. We do both the upstream
// `codebuff` name (in case the user previously had the upstream package) and
// the fork's `codebuff-mod` name so the launcher always fetches a fresh build
// from GitHub Releases on first run.
const configDir = path.join(os.homedir(), '.config', 'manicode');
const staleBinaries = process.platform === 'win32'
  ? ['codebuff.exe', 'codebuff-mod.exe']
  : ['codebuff', 'codebuff-mod'];

for (const name of staleBinaries) {
  try {
    fs.unlinkSync(path.join(configDir, name));
  } catch (e) {
    /* ignore if file doesn't exist */
  }
}

// Print welcome message
console.log('\n');
console.log('🎉 codebuff-mod installed.');
console.log('\n');
console.log('BYOK fork — bring your own API key.');
console.log('\n');
console.log('Quick start:');
console.log('  1. cd to your project directory');
console.log('  2. Run: cbm');
console.log('  3. In the CLI: /providers:add <preset> <apiKey>');
console.log('     Presets: openai, anthropic, openrouter, opencode-go, deepseek, gemini,');
console.log('              mistral, together, groq, custom-openai');
console.log('\n');
console.log('Repo: https://github.com/EstarinAzx/codebuff');
console.log('\n');
