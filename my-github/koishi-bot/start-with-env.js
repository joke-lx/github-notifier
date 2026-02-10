#!/usr/bin/env node

/**
 * Koishi 启动脚本 - 加载环境变量
 *
 * 此脚本在启动 Koishi 之前加载 .env 文件中的环境变量
 * 确保 koishi.yml 中的 ${ENV_VAR} 引用能够正确替换
 */

import { config } from 'dotenv'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// 获取当前文件所在目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载 .env 文件
const result = config({ path: join(__dirname, '.env') })

if (result.error) {
  console.error('❌ 加载 .env 文件失败:', result.error.message)
  process.exit(1)
}

console.log('✅ 环境变量已加载')
console.log('📝 GLM_API_KEY:', process.env.GLM_API_KEY ? '已设置' : '未设置')
console.log('📝 NOTION_TOKEN:', process.env.NOTION_TOKEN ? '已设置' : '未设置')
console.log('📝 NOTION_DATABASE_ID:', process.env.NOTION_DATABASE_ID ? '已设置' : '未设置')
console.log('')

// 启动 Koishi
const koishi = spawn('npx', ['koishi', 'start'], {
  stdio: 'inherit',
  env: process.env
})

koishi.on('exit', (code) => {
  process.exit(code)
})
