#!/usr/bin/env node

const { program } = require('commander');
const { concurrently } = require('concurrently');
const path = require('path');
const chalk = require('chalk');

program
  .name('dev-impact')
  .description('DevImpact CLI - Monitor your system with style')
  .version('1.0.0');

program
  .command('start')
  .description('Start the monitoring backend and agent')
  .option('-p, --port <number>', 'Port for the backend API', '5001')
  .option('--db-host <host>', 'MySQL database host', 'localhost')
  .option('--db-user <user>', 'MySQL database user', 'root')
  .option('--db-pass <password>', 'MySQL database password', '')
  .option('--db-name <name>', 'MySQL database name', 'infra_observer')
  .option('-u, --ui', 'Also launch the desktop widget')
  .action((options) => {
    console.log(chalk.bold.green('\n🚀 Starting DevImpact services...\n'));

    const rootDir = path.resolve(__dirname, '..');

    const env = {
      ...process.env,
      PORT: options.port,
      DB_HOST: options.db_host,
      DB_USER: options.db_user,
      DB_PASSWORD: options.db_pass,
      DB_NAME: options.db_name
    };

    const commands = [
      {
        command: `node ${path.join(rootDir, 'backend/server.js')}`,
        name: 'backend',
        prefixColor: 'blue',
        env: env
      },
      {
        command: `node ${path.join(rootDir, 'agent/index.js')}`,
        name: 'agent',
        prefixColor: 'magenta',
        env: env
      }
    ];

    if (options.ui) {
      commands.push({
        command: 'npm start',
        name: 'widget',
        prefixColor: 'yellow',
        cwd: path.join(rootDir, 'widget'),
        env: env
      });
    }

    const { result } = concurrently(commands, {
      prefix: 'name',
      killOthers: ['failure'],
      restartTries: 3,
    });

    result.catch((err) => {
      console.error(chalk.bold.red('\n❌ A service stopped unexpectedly.\n'));
    });
  });

program
  .command('ui')
  .description('Launch the desktop widget (requires backend to be running)')
  .action(() => {
    const rootDir = path.resolve(__dirname, '..');
    console.log(chalk.bold.yellow('\n🖥️ Launching DevImpact Widget...\n'));

    concurrently([
      {
        command: 'npm start',
        name: 'widget',
        prefixColor: 'yellow',
        cwd: path.join(rootDir, 'widget')
      }
    ]);
  });

if (!process.argv.slice(2).length) {
  process.argv.push("start", "--ui");
}

program.parse();
