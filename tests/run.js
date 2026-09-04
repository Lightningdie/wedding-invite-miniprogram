/**
 * 零依赖测试运行器：node tests/run.js
 * 自动发现 tests/ 下所有 *.test.js（helpers/ 与 run.js 自身除外），
 * 顺序执行 describe/it，输出 ✓/✗ 与失败详情，结尾汇总，退出码 0/1。
 */
const fs = require('fs')
const path = require('path')

// ---------- 深比较 ----------
function deepEqual(a, b) {
  if (Object.is(a, b)) return true
  if (a === null || b === null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => deepEqual(a[k], b[k]))
}

// ---------- 断言库 ----------
const assert = {
  ok(cond, msg) {
    if (!cond) throw new Error(msg || '断言失败：期望为真')
  },
  fail(msg) {
    throw new Error(msg || 'fail()')
  },
  equal(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(
        msg ||
          `断言失败：期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`
      )
    }
  },
  deepEqual(actual, expected, msg) {
    if (!deepEqual(actual, expected)) {
      throw new Error(
        msg ||
          `断言失败：深比较不一致\n  期望 ${JSON.stringify(expected)}\n  实际 ${JSON.stringify(actual)}`
      )
    }
  },
  includes(haystack, needle, msg) {
    const hit =
      typeof haystack === 'string'
        ? haystack.indexOf(needle) >= 0
        : Array.isArray(haystack)
          ? haystack.some((v) => deepEqual(v, needle))
          : false
    if (!hit) {
      throw new Error(
        msg || `断言失败：${JSON.stringify(haystack)} 应包含 ${JSON.stringify(needle)}`
      )
    }
  },
  notIncludes(haystack, needle, msg) {
    const hit =
      typeof haystack === 'string'
        ? haystack.indexOf(needle) >= 0
        : Array.isArray(haystack)
          ? haystack.some((v) => deepEqual(v, needle))
          : false
    if (hit) {
      throw new Error(
        msg || `断言失败：${JSON.stringify(haystack)} 不应包含 ${JSON.stringify(needle)}`
      )
    }
  },
  match(value, regex, msg) {
    if (!regex.test(String(value))) {
      throw new Error(msg || `断言失败：${JSON.stringify(String(value))} 不匹配 ${regex}`)
    }
  },
  async rejects(fn, pattern, msg) {
    let err = null
    try {
      await fn()
    } catch (e) {
      err = e
    }
    if (!err) {
      throw new Error(msg || '断言失败：期望 Promise reject，实际 resolve')
    }
    if (pattern && !pattern.test(String(err && err.message))) {
      throw new Error(
        msg || `断言失败：reject 信息「${err && err.message}」不匹配 ${pattern}`
      )
    }
  }
}

// ---------- 用例收集 ----------
const ctx = { suites: [], stack: [], hooks: { beforeEach: [], afterEach: [] } }

function describe(name, fn) {
  ctx.stack.push(name)
  const before = ctx.hooks.beforeEach.length
  const after = ctx.hooks.afterEach.length
  fn()
  ctx.suites.push({
    name: ctx.stack.join(' › '),
    beforeEach: ctx.hooks.beforeEach.slice(before),
    afterEach: ctx.hooks.afterEach.slice(after),
    tests: ctx.tests.splice(0)
  })
  ctx.stack.pop()
}

function it(name, fn) {
  if (!ctx.tests) ctx.tests = []
  ctx.tests.push({
    name,
    fn,
    suite: ctx.stack.join(' › ')
  })
}

function beforeEach(fn) {
  ctx.hooks.beforeEach.push(fn)
}
function afterEach(fn) {
  ctx.hooks.afterEach.push(fn)
}

// ---------- 执行 ----------
async function runSuite(suite) {
  for (const t of suite.tests) {
    process.stdout.write(`  ${suite.name} › ${t.name} ... `)
    const started = Date.now()
    try {
      for (const h of suite.beforeEach) await h()
      await t.fn()
      for (const h of suite.afterEach) await h()
      console.log(`ok (${Date.now() - started}ms)`)
    } catch (e) {
      console.log('FAILED')
      console.log(`    ✗ ${t.name}`)
      console.log(
        '    ' + String(e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n    ') : e)
      )
      ctx.failures.push(`${suite.name} › ${t.name}: ${e && e.message}`)
    }
  }
}

async function main() {
  ctx.failures = []
  ctx.tests = []
  const testDir = __dirname
  const files = fs
    .readdirSync(testDir, { recursive: true })
    .filter(
      (f) =>
        String(f).endsWith('.test.js') &&
        String(f).indexOf('helpers') < 0 &&
        !String(f).includes('node_modules')
    )
    .map((f) => path.join(testDir, f))
    .sort()

  for (const file of files) {
    require(file)
  }

  for (const suite of ctx.suites) {
    await runSuite(suite)
  }

  const total = ctx.suites.reduce((n, s) => n + s.tests.length, 0)
  const failed = ctx.failures.length
  console.log('')
  console.log('========== 测试汇总 ==========')
  console.log(`用例总数: ${total}`)
  console.log(`通过: ${total - failed}`)
  console.log(`失败: ${failed}`)
  if (failed) {
    console.log('')
    console.log('失败用例:')
    ctx.failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`))
  }
  process.exitCode = failed ? 1 : 0
}

module.exports = { describe, it, beforeEach, afterEach, assert, deepEqual, main }

if (require.main === module) {
  process.on('uncaughtException', (e) => {
    console.error('[未捕获异常] 测试进程崩溃：')
    console.error(e && e.stack ? e.stack : e)
    process.exitCode = 1
    process.exit(1)
  })
  main()
}
