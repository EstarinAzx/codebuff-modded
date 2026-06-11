import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  addProfile,
  clearActiveProfile,
  describeProfileForLog,
  getActiveProfile,
  getPresetDefaults,
  listPresets,
  loadProfiles,
  maskApiKey,
  removeProfile,
  saveProfiles,
  setActiveProfile,
  updateProfile,
  type ProviderProfile,
} from '../providers'

let tmpDir: string
let tmpFile: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-providers-'))
  tmpFile = path.join(tmpDir, 'providers.json')
})

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
})

describe('providers — file I/O', () => {
  test('loadProfiles on missing file returns empty', () => {
    expect(loadProfiles(tmpFile)).toEqual([])
  })

  test('addProfile writes a profile and sets it active when first', () => {
    const profile = addProfile(
      {
        name: 'My OAI',
        preset: 'openai',
        apiKey: 'sk-test-123456',
      },
      tmpFile,
    )

    expect(profile.id).toMatch(/^prof_/)
    expect(profile.name).toBe('My OAI')
    expect(profile.preset).toBe('openai')
    expect(profile.provider).toBe('openai')
    expect(profile.baseUrl).toBe('https://api.openai.com/v1')
    expect(profile.model).toBe('gpt-5.1')
    expect(profile.apiKey).toBe('sk-test-123456')

    const loaded = loadProfiles(tmpFile)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe(profile.id)

    const active = getActiveProfile(tmpFile)
    expect(active?.id).toBe(profile.id)
  })

  test('atomic write: providers.json is JSON-parseable and has expected shape', () => {
    addProfile(
      { name: 'A', preset: 'anthropic', apiKey: 'sk-ant-x' },
      tmpFile,
    )
    const raw = fs.readFileSync(tmpFile, 'utf8')
    const parsed = JSON.parse(raw)
    expect(parsed.version).toBe(2)
    expect(parsed.profiles).toHaveLength(1)
    expect(parsed.activeProfileId).toBe(parsed.profiles[0].id)
  })

  test('file perms are 0600 on POSIX (skipped on Windows)', () => {
    if (process.platform === 'win32') return
    addProfile(
      { name: 'A', preset: 'openai', apiKey: 'sk-x' },
      tmpFile,
    )
    const mode = fs.statSync(tmpFile).mode & 0o777
    expect(mode).toBe(0o600)
  })

  test('second addProfile does NOT steal active by default', () => {
    const first = addProfile(
      { name: 'first', preset: 'openai', apiKey: 'sk-1' },
      tmpFile,
    )
    addProfile({ name: 'second', preset: 'anthropic', apiKey: 'sk-2' }, tmpFile)

    const active = getActiveProfile(tmpFile)
    expect(active?.id).toBe(first.id)
  })

  test('makeActive: true forces switch on second add', () => {
    addProfile({ name: 'first', preset: 'openai', apiKey: 'sk-1' }, tmpFile)
    const second = addProfile(
      { name: 'second', preset: 'anthropic', apiKey: 'sk-2', makeActive: true },
      tmpFile,
    )
    expect(getActiveProfile(tmpFile)?.id).toBe(second.id)
  })

  test('setActiveProfile switches active', () => {
    addProfile({ name: 'first', preset: 'openai', apiKey: 'sk-1' }, tmpFile)
    const second = addProfile(
      { name: 'second', preset: 'anthropic', apiKey: 'sk-2' },
      tmpFile,
    )
    setActiveProfile(second.id, tmpFile)
    expect(getActiveProfile(tmpFile)?.id).toBe(second.id)
  })

  test('setActiveProfile with unknown id returns null and does not change state', () => {
    const first = addProfile(
      { name: 'first', preset: 'openai', apiKey: 'sk-1' },
      tmpFile,
    )
    const result = setActiveProfile('prof_doesnotexist', tmpFile)
    expect(result).toBeNull()
    expect(getActiveProfile(tmpFile)?.id).toBe(first.id)
  })

  test('clearActiveProfile nulls out active', () => {
    addProfile({ name: 'first', preset: 'openai', apiKey: 'sk-1' }, tmpFile)
    clearActiveProfile(tmpFile)
    expect(getActiveProfile(tmpFile)).toBeNull()
  })

  test('removeProfile deletes and reassigns active when active was removed', () => {
    const first = addProfile(
      { name: 'first', preset: 'openai', apiKey: 'sk-1' },
      tmpFile,
    )
    const second = addProfile(
      { name: 'second', preset: 'anthropic', apiKey: 'sk-2' },
      tmpFile,
    )
    expect(getActiveProfile(tmpFile)?.id).toBe(first.id)

    expect(removeProfile(first.id, tmpFile)).toBe(true)
    expect(loadProfiles(tmpFile)).toHaveLength(1)
    // Active was the removed profile → falls back to the first remaining
    expect(getActiveProfile(tmpFile)?.id).toBe(second.id)
  })

  test('removeProfile on unknown id returns false', () => {
    expect(removeProfile('prof_nope', tmpFile)).toBe(false)
  })

  test('updateProfile mutates only patched fields', () => {
    const profile = addProfile(
      { name: 'A', preset: 'openai', apiKey: 'sk-x' },
      tmpFile,
    )
    const updated = updateProfile(
      profile.id,
      { model: 'gpt-4o', apiKey: 'sk-new' },
      tmpFile,
    )
    expect(updated?.model).toBe('gpt-4o')
    expect(updated?.apiKey).toBe('sk-new')
    expect(updated?.baseUrl).toBe(profile.baseUrl)
    expect(updated?.name).toBe(profile.name)
  })

  test('updateProfile on unknown id returns null', () => {
    expect(updateProfile('prof_nope', { model: 'x' }, tmpFile)).toBeNull()
  })

  test('saveProfiles preserves active when active still present', () => {
    const first = addProfile(
      { name: 'first', preset: 'openai', apiKey: 'sk-1' },
      tmpFile,
    )
    const second = addProfile(
      { name: 'second', preset: 'anthropic', apiKey: 'sk-2' },
      tmpFile,
    )
    saveProfiles([first, second], tmpFile)
    expect(getActiveProfile(tmpFile)?.id).toBe(first.id)
  })

  test('saveProfiles drops active when the active profile was removed from list', () => {
    const first = addProfile(
      { name: 'first', preset: 'openai', apiKey: 'sk-1' },
      tmpFile,
    )
    const second = addProfile(
      { name: 'second', preset: 'anthropic', apiKey: 'sk-2' },
      tmpFile,
    )
    saveProfiles([second], tmpFile)
    expect(getActiveProfile(tmpFile)).toBeNull()
    expect(loadProfiles(tmpFile)).toHaveLength(1)
    void first
  })
})

describe('providers — validation', () => {
  test('addProfile rejects when API key required but missing', () => {
    expect(() =>
      addProfile({ name: 'oops', preset: 'openai' }, tmpFile),
    ).toThrow(/apiKey required/)
  })

  test('addProfile allows custom-openai without API key when baseUrl is supplied', () => {
    const profile = addProfile(
      {
        name: 'localhost',
        preset: 'custom-openai',
        baseUrl: 'http://localhost:1234/v1',
        model: 'local',
      },
      tmpFile,
    )
    expect(profile.preset).toBe('custom-openai')
    expect(profile.apiKey).toBe('')
  })

  test('addProfile rejects custom-openai without baseUrl (preset default is empty)', () => {
    expect(() =>
      addProfile({ name: 'oops', preset: 'custom-openai' }, tmpFile),
    ).toThrow(/baseUrl required/)
  })

  test('corrupt JSON file is treated as empty', () => {
    fs.writeFileSync(tmpFile, '{not json')
    expect(loadProfiles(tmpFile)).toEqual([])
    expect(getActiveProfile(tmpFile)).toBeNull()
  })

  test('file with garbage profile entries drops invalid ones', () => {
    fs.writeFileSync(
      tmpFile,
      JSON.stringify({
        version: 1,
        activeProfileId: 'prof_bogus',
        profiles: [
          { id: 'prof_ok', name: 'Good', preset: 'openai', provider: 'openai', baseUrl: 'https://x/v1', model: 'm', apiKey: 'k', createdAt: '2024' },
          { id: 'prof_bad', name: 'Bad', preset: 'not-a-preset', provider: 'openai', baseUrl: 'https://x/v1', model: 'm', apiKey: 'k', createdAt: '2024' },
          { id: 'prof_bad2', name: 'No baseUrl', preset: 'openai', provider: 'openai', baseUrl: '', model: 'm', apiKey: 'k', createdAt: '2024' },
        ],
      }),
    )
    const loaded = loadProfiles(tmpFile)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('prof_ok')
    // Active referenced a non-existent profile → cleared
    expect(getActiveProfile(tmpFile)).toBeNull()
  })

  test('baseUrl trailing slashes get normalized', () => {
    const profile = addProfile(
      {
        name: 'A',
        preset: 'custom-openai',
        baseUrl: 'https://api.example.com/v1////',
        model: 'm',
      },
      tmpFile,
    )
    expect(profile.baseUrl).toBe('https://api.example.com/v1')
  })
})

describe('providers — presets', () => {
  test('all presets resolve to non-empty defaults (except custom-openai baseUrl/model)', () => {
    for (const preset of listPresets()) {
      const d = getPresetDefaults(preset)
      expect(d.preset).toBe(preset)
      expect(d.name.length).toBeGreaterThan(0)
      expect(d.provider === 'openai' || d.provider === 'anthropic').toBe(true)
      if (preset !== 'custom-openai') {
        expect(d.baseUrl.length).toBeGreaterThan(0)
        expect(d.defaultModel.length).toBeGreaterThan(0)
      }
    }
  })

  test('anthropic preset uses anthropic protocol; rest use openai-compat', () => {
    expect(getPresetDefaults('anthropic').provider).toBe('anthropic')
    for (const preset of listPresets()) {
      if (preset === 'anthropic') continue
      expect(getPresetDefaults(preset).provider).toBe('openai')
    }
  })
})

describe('providers — log safety', () => {
  test('maskApiKey shows only last 4', () => {
    expect(maskApiKey('sk-12345678')).toBe('****5678')
    expect(maskApiKey('abcd')).toBe('****')
    expect(maskApiKey('')).toBe('<unset>')
    expect(maskApiKey(undefined)).toBe('<unset>')
  })

  test('describeProfileForLog masks the key', () => {
    const profile: ProviderProfile = {
      id: 'prof_x',
      name: 'My OpenAI',
      preset: 'openai',
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-5.1',
      apiKey: 'sk-very-secret-1234',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const described = describeProfileForLog(profile)
    expect(described.apiKey).toBe('****1234')
    expect(JSON.stringify(described)).not.toContain('very-secret')
  })
})
