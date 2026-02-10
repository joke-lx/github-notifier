/**
 * 代码管理器
 *
 * 核心原理：
 * 1. 使用 git clone 拉取完整代码库
 * 2. 智能过滤无关文件（node_modules、dist 等）
 * 3. 提取核心代码结构用于分析
 * 4. 分析完成后立即清理，避免磁盘占用
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { execSync } = require('child_process');

const execAsync = promisify(require('child_process').exec);

class CodeManager {
  constructor() {
    this.tempDir = process.env.TEMP_CODE_DIR || '/tmp/github-analysis';
    this.maxSizeMB = parseInt(process.env.MAX_REPO_SIZE_MB) || 50;
    this.maxFileCount = parseInt(process.env.MAX_FILE_COUNT) || 500;
    this.maxFileSize = 1024 * 100; // 100KB
    this.cloneTimeout = parseInt(process.env.GIT_CLONE_TIMEOUT_MS) || 60000;
    this.maxRetries = parseInt(process.env.MAX_RETRIES) || 3;
    this.retryDelay = parseInt(process.env.RETRY_DELAY_MS) || 2000;

    // 确保临时目录存在
    this.ensureTempDir();
  }

  /**
   * 确保临时目录存在
   */
  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * 克隆 GitHub 仓库
   * 使用浅克隆（--depth 1）减少下载量
   */
  async cloneRepository(repoUrl, repoName) {
    const safeName = this.sanitizeName(repoName);
    const targetDir = path.join(this.tempDir, safeName);

    // 检查是否已存在，先清理
    if (fs.existsSync(targetDir)) {
      await this.cleanupDirectory(targetDir);
    }

    const startTime = Date.now();

    try {
      // 使用浅克隆，只下载最新代码
      const command = `git clone --depth 1 --single-branch ${repoUrl} ${targetDir}`;

      await execAsync(command, {
        timeout: this.cloneTimeout,
        stdio: 'pipe'
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`    ✓ 克隆成功 (${duration}s)`);

      // 检查仓库大小
      const size = this.getDirectorySize(targetDir);
      const sizeMB = (size / 1024 / 1024).toFixed(2);

      if (size > this.maxSizeMB * 1024 * 1024) {
        throw new Error(`仓库过大 (${sizeMB}MB > ${this.maxSizeMB}MB)`);
      }

      return targetDir;
    } catch (error) {
      // 失败时立即清理
      await this.cleanupDirectory(targetDir).catch(() => {});

      if (error.killed) {
        throw new Error('克隆超时（超过 60 秒）');
      }
      throw new Error(`克隆失败: ${error.message}`);
    }
  }

  /**
   * 获取相关代码文件
   * 智能过滤：排除 node_modules、dist、test 等
   */
  async getRelevantFiles(repoDir) {
    const ignoredPatterns = [
      'node_modules/**',
      'dist/**',
      'build/**',
      'out/**',
      '*.min.js',
      '*.min.css',
      '*.test.js',
      '*.test.ts',
      '*.spec.js',
      '*.spec.ts',
      'coverage/**',
      '.git/**',
      'vendor/**',
      '__tests__/**',
      'test/**',
      'tests/**',
      '*.d.ts',
      '*.map',
      '.vscode/**',
      '.idea/**'
    ];

    const files = [];
    let fileCount = 0;

    const walk = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(repoDir, fullPath);

          // 跳过忽略的文件/目录
          if (this.shouldIgnore(relativePath, ignoredPatterns)) {
            continue;
          }

          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            const stats = fs.statSync(fullPath);

            // 只分析代码文件
            if (this.isCodeFile(ext) && stats.size < this.maxFileSize) {
              files.push({
                path: relativePath,
                fullPath,
                size: stats.size,
                ext
              });

              fileCount++;
              if (fileCount >= this.maxFileCount) {
                return;
              }
            }
          }
        }
      } catch (error) {
        // 忽略无法访问的目录
      }
    };

    walk(repoDir);

    // 按重要性排序
    return this.sortFilesByImportance(files);
  }

  /**
   * 提取代码结构
   * 从文件中提取预览内容，控制 Token 消耗
   */
  async extractCodeStructure(files, maxTokens = 3000) {
    const structure = {
      summary: '',
      keyFiles: [],
      totalSize: 0,
      fileCount: files.length
    };

    let usedChars = 0;
    const maxChars = maxTokens * 2; // 粗略估算 1 token ≈ 2 字符

    // 生成目录结构摘要
    structure.summary = this.generateDirectorySummary(files);

    // 提取核心文件内容
    for (const file of files) {
      if (usedChars >= maxChars) {
        break;
      }

      try {
        const content = fs.readFileSync(file.fullPath, 'utf-8');
        const preview = this.getCodePreview(content, 500);
        const chars = preview.length;

        if (usedChars + chars > maxChars) {
          break;
        }

        structure.keyFiles.push({
          path: file.path,
          preview,
          size: file.size
        });

        usedChars += chars;
        structure.totalSize += file.size;
      } catch (error) {
        // 忽略读取失败的文件
      }
    }

    return structure;
  }

  /**
   * 获取代码预览
   * 提取核心部分，跳过注释和空行
   */
  getCodePreview(content, maxLength) {
    const lines = content.split('\n');
    const result = [];
    let currentLength = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // 跳过空行和单行注释
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
        continue;
      }

      // 跳过 import/export 语句（通常不重要）
      if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
        continue;
      }

      if (currentLength + line.length > maxLength) {
        break;
      }

      result.push(line);
      currentLength += line.length + 1;
    }

    return result.join('\n');
  }

  /**
   * 清理目录
   * 安全删除，支持 finally 块
   */
  async cleanupDirectory(dir) {
    try {
      if (!fs.existsSync(dir)) {
        return;
      }

      // 使用原生 rm 方法（Node.js 14.14.0+）
      if (fs.promises.rm) {
        await fs.promises.rm(dir, { recursive: true, force: true });
      } else {
        // 回退到系统命令
        execSync(`rm -rf "${dir}"`, { stdio: 'ignore' });
      }

      console.log(`    ✓ 清理完成: ${path.basename(dir)}`);
    } catch (error) {
      console.warn(`    ⚠️  清理失败: ${error.message}`);
      // 不抛出异常，确保流程继续
    }
  }

  /**
   * 清理所有临时目录
   * 用于启动时清理残留
   */
  async cleanupAllTempDirectories() {
    try {
      if (!fs.existsSync(this.tempDir)) {
        return 0;
      }

      const repos = fs.readdirSync(this.tempDir);
      let cleaned = 0;

      for (const repo of repos) {
        const repoPath = path.join(this.tempDir, repo);

        try {
          // 检查目录年龄（超过 1 小时自动清理）
          const stats = fs.statSync(repoPath);
          const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);

          if (ageHours > 1) {
            await this.forceDeleteDirectory(repoPath);
            cleaned++;
            console.log(`  清理过期代码: ${repo}`);
          }
        } catch (error) {
          // 强制删除失败的目录
          await this.forceDeleteDirectory(repoPath).catch(() => {});
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`  ✓ 清理了 ${cleaned} 个临时代码目录`);
      }

      return cleaned;
    } catch (error) {
      console.error('  清理临时代码失败:', error.message);
      return 0;
    }
  }

  /**
   * 强制删除目录
   */
  async forceDeleteDirectory(dirPath) {
    try {
      if (fs.promises.rm) {
        await fs.promises.rm(dirPath, { recursive: true, force: true });
      } else {
        execSync(`rm -rf "${dirPath}"`, { stdio: 'ignore' });
      }
    } catch (error) {
      // 忽略失败
    }
  }

  /**
   * 清理文件名（防止路径遍历攻击）
   */
  sanitizeName(name) {
    return name.replace(/[^a-zA-Z0-9-_]/g, '_');
  }

  /**
   * 检查文件是否应该被忽略
   */
  shouldIgnore(filePath, patterns) {
    return patterns.some(pattern => {
      const regex = new RegExp(
        pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')
      );
      return regex.test(filePath);
    });
  }

  /**
   * 检查是否是代码文件
   */
  isCodeFile(ext) {
    const codeExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.vue',
      '.py', '.go', '.rs', '.java',
      '.c', '.cpp', '.h', '.cs',
      '.rb', '.php', '.swift', '.kt'
    ];
    return codeExtensions.includes(ext);
  }

  /**
   * 按重要性排序文件
   */
  sortFilesByImportance(files) {
    const priority = {
      'index': 10,
      'main': 9,
      'app': 8,
      'core': 7,
      'init': 6,
      'utils': 5,
      'package': 4
    };

    return files.sort((a, b) => {
      const aName = path.basename(a.path, a.ext).toLowerCase();
      const bName = path.basename(b.path, b.ext).toLowerCase();
      const aPriority = priority[aName] || 0;
      const bPriority = priority[bName] || 0;

      // 优先级高的在前
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // 同优先级时，深度优先（根目录文件更重要）
      const aDepth = a.path.split('/').length;
      const bDepth = b.path.split('/').length;

      if (aDepth !== bDepth) {
        return aDepth - bDepth;
      }

      // 最后按文件名排序
      return a.path.localeCompare(b.path);
    });
  }

  /**
   * 生成目录结构摘要
   */
  generateDirectorySummary(files) {
    const tree = {};

    for (const file of files) {
      const parts = file.path.split('/');
      let current = tree;

      for (const part of parts) {
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
    }

    // 转换为可读格式
    const formatTree = (obj, indent = 0) => {
      const lines = [];
      const entries = Object.entries(obj).slice(0, 20); // 最多显示 20 项

      for (const [name, children] of entries) {
        const isFile = Object.keys(children).length === 0;
        const prefix = '  '.repeat(indent);
        lines.push(`${prefix}${isFile ? '📄' : '📁'} ${name}`);

        if (!isFile) {
          lines.push(...formatTree(children, indent + 1));
        }
      }

      return lines;
    };

    return formatTree(tree).join('\n');
  }

  /**
   * 获取目录大小
   */
  getDirectorySize(dirPath) {
    let totalSize = 0;

    const calcSize = (path) => {
      try {
        const stats = fs.statSync(path);

        if (stats.isDirectory()) {
          const files = fs.readdirSync(path);

          for (const file of files) {
            calcSize(dirPath + '/' + file);
          }
        } else {
          totalSize += stats.size;
        }
      } catch (error) {
        // 忽略无法访问的文件
      }
    };

    calcSize(dirPath);
    return totalSize;
  }
}

module.exports = CodeManager;
