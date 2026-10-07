const { spawnSync } = require('child_process');

process.env.GENERATE_SOURCEMAP = 'false';
const reactScripts = require.resolve('react-scripts/bin/react-scripts');
const result = spawnSync(process.execPath, [reactScripts, 'build'], { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
