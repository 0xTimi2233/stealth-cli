import { join } from 'node:path'

const version = process.argv[2]
if (!version || !/^\d+\.\d+\.\d+.*$/.test(version)) {
  console.error('用法: bun scripts/bump.ts <x.y.z>')
  process.exit(1)
}

const root = join(import.meta.dir, '..')
const pkgPath = join(root, 'package.json')
const verPath = join(root, 'src/domain/version.ts')

const pkg = JSON.parse(await Bun.file(pkgPath).text())
pkg.version = version
await Bun.write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
await Bun.write(verPath, `export const VERSION = '${version}'\n`)

console.log(`版本号已同步更新至 ${version}`)
