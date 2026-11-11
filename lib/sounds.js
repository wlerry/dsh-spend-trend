/**
 * User-supplied alarm sounds: files dropped into `$DSH_HOME/spend-trend-sounds/`
 * become extra presets beside the bundled clips and synthesised tones.
 *
 * The directory is the only place the host reads from, names are single path
 * segments, and only the four browser-playable extensions are accepted.
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Extension → media type for the files the browser can play. */
export const SOUND_TYPES = {
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
}

/** Largest custom clip the host will serve. */
export const MAX_SOUND_BYTES = 4 * 1024 * 1024

/** Directory the user drops clips into. */
export function soundsDir(home = process.env.DSH_HOME ?? join(homedir(), '.dsh')) {
  return join(home, 'spend-trend-sounds')
}

function extensionOf(name) {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot).toLowerCase()
}

/**
 * Validate one requested file name.
 * @param name - a single path segment naming a file in the sound directory.
 * @returns the media type, or undefined when the name is not acceptable.
 */
export function soundTypeOf(name) {
  if (typeof name !== 'string' || name === '' || name.length > 120) return undefined
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) return undefined
  if (name.startsWith('.')) return undefined
  return SOUND_TYPES[extensionOf(name)]
}

/**
 * List the user's clips, sorted by name.
 * @param dir - the sound directory; a missing directory yields an empty list.
 * @returns `[{ id, name, size }]`, where `id` is `custom:<file name>`.
 */
export function listSounds(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const sounds = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (soundTypeOf(entry.name) === undefined) continue
    let size
    try {
      size = statSync(join(dir, entry.name)).size
    } catch {
      continue
    }
    if (size === 0 || size > MAX_SOUND_BYTES) continue
    sounds.push({ id: `custom:${entry.name}`, name: entry.name, size })
  }
  return sounds.sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Turn an uploaded name into a safe single-segment file name.
 * @param raw - the client-supplied name, possibly a path.
 */
export function safeName(raw) {
  const text = String(raw ?? '')
  const base = text.split(/[\\/]/).pop() ?? ''
  return base.trim()
}

/**
 * Write one uploaded clip into the sound directory.
 * @param dir - destination directory; created when absent.
 * @param rawName - the uploaded file name.
 * @param bytes - the uploaded body.
 * @returns `{ name }` with the stored file name (a numeric suffix avoids overwriting).
 * @throws when the name, type, size or body is unacceptable.
 */
export function importSound(dir, rawName, bytes) {
  const base = safeName(rawName)
  if (soundTypeOf(base) === undefined) throw new Error('unsupported file type')
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) throw new Error('empty file')
  if (bytes.byteLength > MAX_SOUND_BYTES) throw new Error('file too large')

  mkdirSync(dir, { recursive: true })
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  let name = base
  for (let index = 2; existsSync(join(dir, name)); index += 1) name = `${stem}-${index}${ext}`
  writeFileSync(join(dir, name), bytes)
  return { name }
}

/**
 * Resolve one requested clip to its absolute path.
 * @param dir - the sound directory.
 * @param name - the requested file name.
 * @returns `{ path, type }`, or undefined when the name is not acceptable.
 */
export function resolveSound(dir, name) {
  const type = soundTypeOf(name)
  if (type === undefined) return undefined
  return { path: join(dir, name), type }
}
