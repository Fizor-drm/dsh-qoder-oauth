/**
 * Qoder campaign resource packages, read through the Qoder Global account API.
 *
 * The official Qoder CLI's `getUsageInfo()` returns the plan, add-on and
 * session buckets but not the campaign grants (`dedicatedResourcePackages`).
 * Those grants are only exposed by the account quota endpoint, which requires
 * a Personal Access Token. This module keeps that optional PAT local, exchanges
 * it for a short-lived job token, and returns the campaign packages for the
 * usage card. It never logs the PAT or the job token.
 *
 * @module dsh-qoder-oauth/qoder-campaign
 */

import { createHash } from 'node:crypto'
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const API_BASE = 'https://openapi.qoder.sh'
const PAT_FILE = join(
  process.env.DSH_HOME ?? join(homedir(), '.dsh'),
  'agent-sdk-bridge',
  'qoder-campaign.json',
)
const CACHE_TTL_MS = 60_000
const TIMEOUT_MS = 12_000
const USER_AGENT = 'qoder/1.1.74'
const COSY_VERSION = '1.1.74'

export interface CampaignPackage {
  id?: string
  name?: string
  title?: { zh?: string; en?: string }
  total: number
  used: number
  remaining: number
  percentage: number
  unit: string
  expiresAt?: string
  available?: boolean
  status?: string
}

interface CachedToken {
  key: string
  token: string
  expiresAt: number
}

interface CachedPackages {
  key: string
  at: number
  packages: CampaignPackage[]
}

let tokenCache: CachedToken | undefined
let packageCache: CachedPackages | undefined

function patKey(pat: string): string {
  return createHash('sha256').update(pat).digest('hex')
}

function baseHeaders(): Record<string, string> {
  return {
    accept: 'application/json',
    'accept-encoding': 'identity',
    'user-agent': USER_AGENT,
    'cosy-clienttype': '5',
    'cosy-version': COSY_VERSION,
  }
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
  operation: string,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Qoder ${operation} failed with HTTP ${response.status}`)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Qoder ${operation} returned invalid JSON`)
  }
}

async function exchangePat(pat: string): Promise<CachedToken> {
  const key = patKey(pat)
  if (tokenCache !== undefined && tokenCache.key === key && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache
  }
  const data = await requestJson<{ token?: string; expires_at?: string; expires_in?: number }>(
    `${API_BASE}/api/v1/jobToken/exchange`,
    {
      method: 'POST',
      headers: { ...baseHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ personal_token: pat }),
    },
    'PAT exchange',
  )
  if (typeof data.token !== 'string' || data.token.length === 0) {
    throw new Error('Qoder PAT exchange returned no job token')
  }
  let expiresAt = Date.now() + 24 * 60 * 60 * 1000
  if (typeof data.expires_at === 'string') {
    const parsed = Date.parse(data.expires_at)
    if (!Number.isNaN(parsed)) expiresAt = parsed
  } else if (typeof data.expires_in === 'number' && data.expires_in > 0) {
    expiresAt = Date.now() + data.expires_in * 1000
  }
  tokenCache = { key, token: data.token, expiresAt }
  return tokenCache
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function toExpiryIso(value: unknown): string | undefined {
  let ms: number | undefined
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) ms = value
  else if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed) && parsed > 0) ms = parsed
  }
  if (ms === undefined) return undefined
  const date = new Date(ms)
  // Qoder uses year 9999 as its "never expires" sentinel.
  return date.getUTCFullYear() >= 9999 ? undefined : date.toISOString()
}

function localizedTitle(raw: Record<string, unknown>): { zh?: string; en?: string } | undefined {
  const labels = Array.isArray(raw.displayLabels) ? raw.displayLabels : []
  const title = labels.find(label => label !== null && typeof label === 'object' && (label as Record<string, unknown>).dimension === 'title') as
    | Record<string, unknown>
    | undefined
  if (title === undefined) return undefined
  const i18n = title.valueI18n
  const fallback = asString(title.value)
  const zh = i18n !== null && typeof i18n === 'object' ? asString((i18n as Record<string, unknown>).zh) : undefined
  const en = i18n !== null && typeof i18n === 'object' ? asString((i18n as Record<string, unknown>).en) : undefined
  if (zh === undefined && en === undefined && fallback === undefined) return undefined
  const out: { zh?: string; en?: string } = {}
  const zhValue = zh ?? fallback
  const enValue = en ?? fallback
  if (zhValue !== undefined) out.zh = zhValue
  if (enValue !== undefined) out.en = enValue
  return out
}

function normalizePackage(raw: unknown): CampaignPackage | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const value = raw as Record<string, unknown>
  const total = asNumber(value.total)
    ?? asNumber(value.cap)
    ?? ((asNumber(value.used) ?? 0) + (asNumber(value.remaining) ?? 0))
  const used = asNumber(value.used) ?? 0
  const remaining = asNumber(value.remaining) ?? Math.max(0, total - used)
  const reported = asNumber(value.percentage)
  let percentage: number
  if (total > 0) percentage = (used / total) * 100
  else if (reported !== undefined) percentage = reported
  else percentage = 0
  const title = localizedTitle(value)
  const id = asString(value.id)
  const name = asString(value.name)
  const status = asString(value.status)
  const expiresAt = toExpiryIso(value.expiresAt)
  return {
    total,
    used,
    remaining,
    percentage,
    unit: asString(value.unit) ?? 'credits',
    ...id === undefined ? {} : { id },
    ...name === undefined ? {} : { name },
    ...title === undefined ? {} : { title },
    ...expiresAt === undefined ? {} : { expiresAt },
    ...typeof value.available === 'boolean' ? { available: value.available } : {},
    ...status === undefined ? {} : { status },
  }
}

export async function fetchCampaignPackages(pat: string): Promise<CampaignPackage[]> {
  const token = await exchangePat(pat)
  const data = await requestJson<{ dedicatedResourcePackages?: unknown }>(
    `${API_BASE}/api/v2/quota/usage`,
    {
      method: 'GET',
      headers: { ...baseHeaders(), authorization: `Bearer ${token.token}` },
    },
    'campaign quota',
  )
  const raw = Array.isArray(data.dedicatedResourcePackages) ? data.dedicatedResourcePackages : []
  return raw.map(normalizePackage).filter((entry): entry is CampaignPackage => entry !== undefined)
}

export async function readCampaignPat(): Promise<string | undefined> {
  try {
    const raw = JSON.parse(await readFile(PAT_FILE, 'utf8')) as { token?: unknown }
    return typeof raw.token === 'string' && raw.token.trim() !== '' ? raw.token.trim() : undefined
  } catch {
    return undefined
  }
}

export async function hasCampaignPat(): Promise<boolean> {
  return (await readCampaignPat()) !== undefined
}

export async function saveCampaignPat(pat: string): Promise<void> {
  await mkdir(join(PAT_FILE, '..'), { recursive: true })
  await writeFile(PAT_FILE, JSON.stringify({ version: 1, token: pat }, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
  await chmod(PAT_FILE, 0o600).catch(() => undefined)
}

export async function clearCampaignPat(): Promise<void> {
  await rm(PAT_FILE, { force: true }).catch(() => undefined)
  packageCache = undefined
  tokenCache = undefined
}

/** Validate by actually reading the campaign quota, then persist the PAT. */
export async function validateAndSaveCampaignPat(pat: string): Promise<void> {
  const key = patKey(pat)
  const packages = await fetchCampaignPackages(pat)
  packageCache = { key, at: Date.now(), packages }
  await saveCampaignPat(pat)
}

/** The campaign packages for the usage card, or undefined when no PAT is set. */
export async function campaignPackagesForUsage(): Promise<CampaignPackage[] | undefined> {
  const pat = await readCampaignPat()
  if (pat === undefined) return undefined
  const key = patKey(pat)
  if (packageCache !== undefined && packageCache.key === key && Date.now() - packageCache.at < CACHE_TTL_MS) {
    return packageCache.packages
  }
  try {
    const packages = await fetchCampaignPackages(pat)
    packageCache = { key, at: Date.now(), packages }
    return packages
  } catch {
    // A failed optional quota lookup must not take down the main quota card.
    return undefined
  }
}
