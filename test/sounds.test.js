import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { importSound, listSounds, resolveSound, soundTypeOf, soundsDir, MAX_SOUND_BYTES } from '../lib/sounds.js'

function withDir(run) {
  const dir = mkdtempSync(join(tmpdir(), 'spend-sounds-'))
  try {
    run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('accepted extensions map to browser media types', () => {
  assert.equal(soundTypeOf('a.m4a'), 'audio/mp4')
  assert.equal(soundTypeOf('a.MP3'), 'audio/mpeg')
  assert.equal(soundTypeOf('a.wav'), 'audio/wav')
  assert.equal(soundTypeOf('a.ogg'), 'audio/ogg')
})

test('path traversal, hidden files and unknown extensions are rejected', () => {
  assert.equal(soundTypeOf('../evil.mp3'), undefined)
  assert.equal(soundTypeOf('sub/evil.mp3'), undefined)
  assert.equal(soundTypeOf('sub\\evil.mp3'), undefined)
  assert.equal(soundTypeOf('.hidden.mp3'), undefined)
  assert.equal(soundTypeOf('notes.txt'), undefined)
  assert.equal(soundTypeOf(''), undefined)
})

test('the sound directory lives under DSH_HOME', () => {
  assert.equal(soundsDir('/tmp/home'), join('/tmp/home', 'spend-trend-sounds'))
})

test('listing keeps only playable, non-empty files', () => withDir((dir) => {
  writeFileSync(join(dir, 'b.mp3'), Buffer.alloc(64))
  writeFileSync(join(dir, 'a.m4a'), Buffer.alloc(64))
  writeFileSync(join(dir, 'empty.wav'), Buffer.alloc(0))
  writeFileSync(join(dir, 'huge.ogg'), Buffer.alloc(MAX_SOUND_BYTES + 1))
  writeFileSync(join(dir, 'readme.txt'), 'hello')

  const sounds = listSounds(dir)
  assert.deepEqual(sounds.map((sound) => sound.name), ['a.m4a', 'b.mp3'])
  assert.deepEqual(sounds.map((sound) => sound.id), ['custom:a.m4a', 'custom:b.mp3'])
}))

test('a missing directory lists nothing instead of throwing', () => {
  assert.deepEqual(listSounds(join(tmpdir(), 'spend-sounds-does-not-exist', 'nope')), [])
})

test('resolving a custom clip yields its path and type', () => withDir((dir) => {
  const resolved = resolveSound(dir, '我的提示音.mp3')
  assert.equal(resolved.type, 'audio/mpeg')
  assert.equal(resolved.path, join(dir, '我的提示音.mp3'))
  assert.equal(resolveSound(dir, '../evil.mp3'), undefined)
}))

test('importing writes the file and keeps a numeric suffix instead of overwriting', () => withDir((dir) => {
  const target = join(dir, 'clips')
  const first = importSound(target, 'my alert.mp3', new Uint8Array([1, 2, 3]))
  const second = importSound(target, 'my alert.mp3', new Uint8Array([4, 5, 6]))
  assert.equal(first.name, 'my alert.mp3')
  assert.equal(second.name, 'my alert-2.mp3')
  assert.deepEqual(listSounds(target).map((sound) => sound.name), ['my alert-2.mp3', 'my alert.mp3'])
}))

test('importing rejects unsupported names, empty bodies and oversized files', () => withDir((dir) => {
  assert.throws(() => importSound(dir, 'notes.txt', new Uint8Array([1])), /unsupported/)
  assert.throws(() => importSound(dir, 'clip.mp3', new Uint8Array([])), /empty/)
  assert.throws(() => importSound(dir, 'clip.mp3', new Uint8Array(MAX_SOUND_BYTES + 1)), /too large/)
}))

test('an uploaded path is reduced to its base name', () => withDir((dir) => {
  const stored = importSound(dir, '/etc/evil/../clip.wav', new Uint8Array([9]))
  assert.equal(stored.name, 'clip.wav')
}))
