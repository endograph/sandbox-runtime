import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { wrapCommandWithSandboxLinux } from '../../src/sandbox/linux-sandbox-utils.js'
import { isLinux } from '../helpers/platform.js'

describe.if(isLinux)('merged-/usr with restrictive reads', () => {
  let base: string
  beforeEach(() => {
    base = realpathSync(mkdtempSync(join(tmpdir(), 'merged-usr-')))
    mkdirSync(join(base, 'project', 'state'), { recursive: true })
    mkdirSync(join(base, 'private'))
    writeFileSync(join(base, 'private', 'secret'), 'host-secret')
    writeFileSync(join(base, 'project', 'visible'), 'visible')
    symlinkSync('private', join(base, 'alias'))
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  async function run(command: string, extraDenies: string[] = []) {
    const wrapped = await wrapCommandWithSandboxLinux({
      command,
      needsNetworkRestriction: false,
      readConfig: {
        denyOnly: ['/', ...extraDenies],
        allowWithinDeny: [
          '/bin',
          '/sbin',
          '/usr',
          '/lib',
          '/lib64',
          join(base, 'project'),
        ],
      },
      writeConfig: {
        allowOnly: [join(base, 'project', 'state')],
        denyWithinAllow: [],
      },
    })
    return spawnSync(wrapped, {
      shell: true,
      cwd: '/',
      encoding: 'utf8',
      timeout: 10000,
    })
  }

  it('starts with system aliases intact, denies unrelated reads, and preserves nested writes', async () => {
    const result = await run(`
      set -eu
      /bin/cat ${base}/project/visible
      test "$(readlink /bin)" = "$(/usr/bin/readlink /bin)"
      ! cat ${base}/private/secret
      ! cat ${base}/alias/secret
      ! sh -c 'echo bad > ${base}/project/visible'
      echo allowed > ${base}/project/state/ok
    `)
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('visible')
    expect(result.stderr).not.toContain("Can't mount")
    expect(readFileSync(join(base, 'project', 'state', 'ok'), 'utf8')).toBe(
      'allowed\n',
    )
    expect(readFileSync(join(base, 'project', 'visible'), 'utf8')).toBe(
      'visible',
    )
  })

  it('an explicit symlink directory deny hides the canonical target and alias', async () => {
    symlinkSync('state', join(base, 'project', 'state-alias'))
    mkdirSync(join(base, 'project', 'secrets'))
    writeFileSync(join(base, 'project', 'secrets', 'token'), 'private-token')
    symlinkSync('secrets', join(base, 'project', 'secret-alias'))
    const result = await run(
      `
      set -eu
      ! cat ${base}/project/secrets/token
      ! cat ${base}/project/secret-alias/token
      echo allowed > ${base}/project/state-alias/ok
    `,
      [join(base, 'project', 'secret-alias')],
    )
    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain('private-token')
    expect(existsSync(join(base, 'project', 'state', 'ok'))).toBe(true)
  })
})
