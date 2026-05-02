#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const { spawn } = require('child_process');
const { startServer } = require('../backend/server');
const { startAgent } = require('../agent/index');

process.on('uncaughtException', (err) => {
  console.error("❌ Uncaught Error:", err);
});

process.on('unhandledRejection', (err) => {
  console.error("❌ Promise Rejection:", err);
});

program
  .name('dev-impact')
  .description('DevImpact CLI - Monitor your system with style')
  .version('1.0.0');

program
  .command('start')
  .description('Start the monitoring backend and agent')
  .option('-p, --port <number>', 'Port for the backend API', '5001')
  .option('-u, --ui', 'Also launch the desktop widget')
  .action((options) => {
    console.log("\n🚀 Starting DevImpact...\n");

    // Start agent
    startAgent();

    console.log("🧠 Intelligence engine active");

    // Start backend internally
    startServer(options.port || 5001);

    // Launch UI (optional but auto-launch by default empty args)
    if (options.ui) {
      const rootDir = path.resolve(__dirname, '..');
      const widgetDir = path.join(rootDir, 'widget');
      
      const widgetProcess = spawn('npm', ['start'], {
          cwd: widgetDir,
          stdio: 'ignore',
          detached: true
      });
      widgetProcess.unref();

      console.log("🖥️ Widget launched");
    }

    console.log("\n✨ DevImpact is running!\n");
  });

program
  .command('ui')
  .description('Launch the desktop widget')
  .action(() => {
    const rootDir = path.resolve(__dirname, '..');
    const widgetDir = path.join(rootDir, 'widget');
    console.log('\n🖥️ Launching DevImpact Widget...\n');
    
    const widgetProcess = spawn('npm', ['start'], {
        cwd: widgetDir,
        stdio: 'ignore',
        detached: true
    });
    widgetProcess.unref();
  });

if (!process.argv.slice(2).length) {
  process.argv.push("start", "--ui");
}

program.parse();
