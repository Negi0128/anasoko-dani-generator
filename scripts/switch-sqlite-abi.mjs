import { existsSync, copyFileSync, mkdirSync, readFileSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'

const target = process.argv[2]
if (target !== 'node' && target !== 'electron') {
  console.error('Usage: node scripts/switch-sqlite-abi.mjs <node|electron>')
  process.exit(1)
}

const pkgVersion = JSON.parse(
  readFileSync(join('node_modules', 'better-sqlite3', 'package.json'), 'utf-8')
).version

const binaryPath = join('node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node')
const cacheDir = join('.cache', 'better-sqlite3')
const cachePath = join(cacheDir, `${target}-${pkgVersion}.node`)

mkdirSync(cacheDir, { recursive: true })

if (existsSync(cachePath)) {
  copyFileSync(cachePath, binaryPath)
  console.log(`[switch-sqlite-abi] restored cached ${target} binary (instant)`)
} else {
  console.log(`[switch-sqlite-abi] no cache for ${target}, building (this may take a while)...`)
  if (target === 'node') {
    execSync('npm rebuild better-sqlite3', { stdio: 'inherit' })
  } else {
    execSync('npx electron-builder install-app-deps', { stdio: 'inherit' })
  }
  copyFileSync(binaryPath, cachePath)
  console.log(`[switch-sqlite-abi] built and cached ${target} binary for next time`)
}
