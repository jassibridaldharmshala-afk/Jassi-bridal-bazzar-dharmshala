const { spawnSync } = require('child_process');

require('./check-theme-tokens.cjs');
if (process.exitCode) process.exit(process.exitCode);

process.env.GENERATE_SOURCEMAP = 'false';
const reactScripts = require.resolve('react-scripts/bin/react-scripts');
const result = spawnSync(process.execPath, [reactScripts, 'build'], { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
