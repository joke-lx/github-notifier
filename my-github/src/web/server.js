/**
 * Web管理界面服务器
 *
 * 功能：
 * 1. 配置管理API
 * 2. 实时日志查看（WebSocket）
 * 3. 报告预览
 * 4. 系统状态监控
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { getLogger } = require('../utils/logger');
const ConfigValidator = require('../utils/config-validator');

class WebServer {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.logger = getLogger('WebServer');
    this.routes = [];
    this.clients = new Set(); // WebSocket客户端

    // API路由
    this.setupRoutes();
  }

  setupRoutes() {
    // 静态文件
    this.addRoute('GET', '/', this.serveStatic('src/web/index.html'));
    this.addRoute('GET', '/api/status', this.getStatus.bind(this));
    this.addRoute('GET', '/api/config', this.getConfig.bind(this));
    this.addRoute('POST', '/api/config', this.updateConfig.bind(this));
    this.addRoute('GET', '/api/logs', this.getLogs.bind(this));
    this.addRoute('GET', '/api/reports', this.getReports.bind(this));
    this.addRoute('GET', '/api/stats', this.getStats.bind(this));
    this.addRoute('POST', '/api/test', this.runTest.bind(this));
    this.addRoute('GET', '/api/cache/stats', this.getCacheStats.bind(this));
    this.addRoute('DELETE', '/api/cache', this.clearCache.bind(this));
  }

  addRoute(method, path, handler) {
    this.routes.push({ method, path, handler });
  }

  start() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // WebSocket升级处理
    this.server.on('upgrade', (req, socket, head) => {
      this.handleWebSocket(req, socket, head);
    });

    this.server.listen(this.port, () => {
      this.logger.success(`Web服务器已启动: http://localhost:${this.port}`);
    });
  }

  async handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const route = this.routes.find(r => r.method === req.method && r.path === url.pathname);

    if (route) {
      try {
        await route.handler(req, res, url);
      } catch (error) {
        this.sendError(res, 500, error.message);
      }
    } else {
      this.sendError(res, 404, 'Not Found');
    }
  }

  // ===== API处理函数 =====

  async getStatus(req, res) {
    const data = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development'
    };
    this.sendJSON(res, data);
  }

  async getConfig(req, res) {
    const validation = ConfigValidator.validate();
    const config = {
      env: { ...process.env },
      validation: {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings
      }
    };

    // 隐藏敏感信息
    const sensitiveKeys = ['TOKEN', 'KEY', 'PASSWORD', 'SECRET', 'AUTH'];
    Object.keys(config.env).forEach(key => {
      if (sensitiveKeys.some(s => key.includes(s))) {
        config.env[key] = '***HIDDEN***';
      }
    });

    this.sendJSON(res, config);
  }

  async updateConfig(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        // 更新环境变量
        Object.keys(data).forEach(key => {
          process.env[key] = data[key];
        });

        // 更新.env文件
        const envPath = path.join(process.cwd(), '.env');
        const envContent = Object.entries(data)
          .map(([k, v]) => `${k}=${v}`)
          .join('\n');

        fs.writeFileSync(envPath, envContent);

        this.sendJSON(res, { success: true, message: '配置已更新，重启后生效' });
      } catch (error) {
        this.sendError(res, 400, error.message);
      }
    });
  }

  async getLogs(req, res) {
    const limit = parseInt(req.url.searchParams.get('limit')) || 100;
    const logFile = path.join(process.cwd(), 'logs/daily.log');

    try {
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf-8');
        const lines = content.split('\n').slice(-limit);
        this.sendJSON(res, { logs: lines });
      } else {
        this.sendJSON(res, { logs: [] });
      }
    } catch (error) {
      this.sendError(res, 500, error.message);
    }
  }

  async getReports(req, res) {
    const historyFile = path.join(process.cwd(), 'data/history.json');

    try {
      if (fs.existsSync(historyFile)) {
        const content = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
        this.sendJSON(res, content);
      } else {
        this.sendJSON(res, { dailyReports: [] });
      }
    } catch (error) {
      this.sendError(res, 500, error.message);
    }
  }

  async getStats(req, res) {
    const { getCache } = require('../utils/cache');
    const cache = getCache();

    const stats = {
      cache: cache.getStats(),
      history: this.getHistoryStats(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version
      }
    };

    this.sendJSON(res, stats);
  }

  async runTest(req, res) {
    const TechDailyScheduler = require('../index');
    const scheduler = new TechDailyScheduler();

    this.sendJSON(res, { success: true, message: '测试任务已启动' });

    // 异步运行测试
    scheduler.runDailyTask().catch(error => {
      this.logger.error('测试任务失败', error);
    });
  }

  async getCacheStats(req, res) {
    const { getCache } = require('../utils/cache');
    const cache = getCache();
    this.sendJSON(res, cache.getStats());
  }

  async clearCache(req, res) {
    const { getCache } = require('../utils/cache');
    const cache = getCache();
    cache.clear();
    this.sendJSON(res, { success: true, message: '缓存已清空' });
  }

  // ===== WebSocket实时日志 =====

  handleWebSocket(req, socket, head) {
    const logger = getLogger('WS');

    // 简单的WebSocket握手
    const key = req.headers['sec-websocket-key'];
    const acceptKey = this.generateWebSocketAccept(key);

    socket.write('HTTP/1.1 101 Switching Protocols\r\n');
    socket.write('Upgrade: websocket\r\n');
    socket.write(`Connection: Upgrade\r\n`);
    socket.write(`Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`);

    this.clients.add(socket);

    socket.on('data', data => {
      // 处理WebSocket消息（这里简化处理）
    });

    socket.on('close', () => {
      this.clients.delete(socket);
      logger.debug('客户端断开连接');
    });

    logger.info('WebSocket连接已建立');
  }

  generateWebSocketAccept(key) {
    const crypto = require('crypto');
    const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
    return crypto.createHash('sha1')
      .update(key + GUID)
      .digest('base64');
  }

  broadcastLog(message) {
    const frame = this.createWebSocketFrame(message);
    this.clients.forEach(client => {
      try {
        client.write(frame);
      } catch (error) {
        this.clients.delete(client);
      }
    });
  }

  createWebSocketFrame(data) {
    const buf = Buffer.from(data);
    const frame = Buffer.allocUnsafe(2 + buf.length);
    frame[0] = 0x81; // FIN + Text frame
    frame[1] = buf.length;
    buf.copy(frame, 2);
    return frame;
  }

  // ===== 辅助函数 =====

  serveStatic(filePath) {
    return (req, res) => {
      const fullPath = path.join(process.cwd(), filePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    };
  }

  sendJSON(res, data) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data, null, 2));
  }

  sendError(res, status, message) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: message }));
  }

  getHistoryStats() {
    const historyFile = path.join(process.cwd(), 'data/history.json');
    try {
      if (fs.existsSync(historyFile)) {
        const content = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
        return {
          totalReports: content.dailyReports?.length || 0,
          lastReport: content.dailyReports?.[content.dailyReports.length - 1]?.date || null
        };
      }
    } catch (error) {
      // Ignore
    }
    return { totalReports: 0, lastReport: null };
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.logger.info('Web服务器已停止');
    }
  }
}

module.exports = WebServer;
