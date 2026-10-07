/**
 * Copies the canonical rooms client into every app that uses it.
 *
 * The apps in this repository are deliberately standalone — no shared
 * packages, no workspace — so each one carries its own copy of the client.
 * This script is what keeps those copies honest:
 *
 *   pnpm sync-client           write the canonical file into every target
 *   pnpm sync-client --check   exit 1 if any copy differs (for CI)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const source = join(here, '..', 'client', 'rooms-client.ts')

/** Every app that talks to the rooms service, and where its copy lives. */
const TARGETS = ['apps/azul/src/net/rooms-client.ts', 'apps/ultimate-ttt/src/net/rooms-client.ts']

const canonical = readFileSync(source, 'utf8')
const check = process.argv.includes('--check')
let drifted = 0

for (const target of TARGETS) {
  const path = join(root, target)
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null
  if (current === canonical) {
    console.log(`  ok       ${target}`)
    continue
  }
  if (check) {
    console.error(`  drifted  ${target}`)
    drifted++
    continue
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, canonical)
  console.log(`  written  ${target}`)
}

if (drifted > 0) {
  console.error(`\n${drifted} copy(ies) differ from ${relative(root, source)}. Run: pnpm sync-client`)
  process.exit(1)
}
