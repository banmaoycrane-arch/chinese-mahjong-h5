/**
 * 阿里云轻量服务器 — 中国麻将静态页
 * 默认端口 3001（与塔防 3000 并存）
 */
const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 3001;
const WEB_ROOT = path.join(__dirname, '..');

const app = express();

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'chinese-mahjong', time: new Date().toISOString() });
});

app.use(express.static(WEB_ROOT, { index: 'index.html', maxAge: '1h' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`中国麻将服务已启动: http://0.0.0.0:${PORT}`);
});
