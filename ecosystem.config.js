// PM2 process file. One Node process uses one CPU core.
// Start with one app; add more (different PORT) when you outgrow one core, and list them in deploy/nginx.conf.
module.exports = {
  apps: [
    { name: 'dcc-1', script: 'server.js', env: { PORT: 3001, TRUST_PROXY: '1', NODE_ENV: 'production' }, max_memory_restart: '400M' }
    // , { name: 'dcc-2', script: 'server.js', env: { PORT: 3002, TRUST_PROXY: '1', NODE_ENV: 'production' }, max_memory_restart: '400M' }
  ]
};
