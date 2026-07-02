/** PM2 进程守护 — 在服务器执行: pm2 start deploy/aliyun/pm2.config.cjs */
module.exports = {
  apps: [{
    name: 'chinese-mahjong',
    cwd: __dirname + '/../../server',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '150M',
    env: {
      PORT: 3001,
      NODE_ENV: 'production',
    },
  }],
};
