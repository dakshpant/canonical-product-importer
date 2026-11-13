// Canonical product fields, grouped as in the brief.
// Names must match the backend (prisma/schema.prisma) exactly.
//
// origin:
//   scraped   - proposed by the app from the page, editable by the admin
//   generated - created by the app (unique), never scraped, read-only here
//   admin     - entered by the admin only; the app never guesses them

export const ORIGIN = {
  SCRAPED: 'scraped',
  GENERATED: 'generated',
  ADMIN: 'admin',
}

export const FIELD_GROUPS = [
  {
    title: 'Basic information',
    fields: [
      { name: 'name', label: 'Name', origin: ORIGIN.SCRAPED, required: true },
      { name: 'sku_id', label: 'SKU ID', origin: ORIGIN.GENERATED },
      { name: 'slug', label: 'Slug', origin: ORIGIN.GENERATED },
      { name: 'product_kind', label: 'Product kind', origin: ORIGIN.SCRAPED },
    ],
  },
  {
    title: 'Categorisation',
    fields: [
      { name: 'category', label: 'Category', origin: ORIGIN.SCRAPED, required: true },
      { name: 'industry', label: 'Industry', origin: ORIGIN.SCRAPED },
      { name: 'sub_category', label: 'Sub-category', origin: ORIGIN.SCRAPED },
    ],
  },
  {
    title: 'Product description',
    fields: [
      { name: 'tagline', label: 'Tagline', origin: ORIGIN.SCRAPED },
      {
        name: 'short_description',
        label: 'Short description',
        origin: ORIGIN.SCRAPED,
        required: true,
        multiline: true,
      },
      { name: 'overview', label: 'Overview', origin: ORIGIN.SCRAPED, multiline: true, rows: 6 },
    ],
  },
  {
    title: 'Product details',
    fields: [
      { name: 'website', label: 'Website', origin: ORIGIN.SCRAPED, type: 'url' },
      { name: 'unit_of_measure', label: 'Unit of measure', origin: ORIGIN.ADMIN },
      { name: 'min_quantity', label: 'Min quantity', origin: ORIGIN.ADMIN, type: 'number' },
      { name: 'max_quantity', label: 'Max quantity', origin: ORIGIN.ADMIN, type: 'number' },
    ],
  },
  {
    title: 'Images',
    fields: [
      { name: 'image_url', label: 'Image URL', origin: ORIGIN.SCRAPED, type: 'url' },
      { name: 'image_alt', label: 'Image alt text', origin: ORIGIN.SCRAPED },
      { name: 'image_type', label: 'Image type', origin: ORIGIN.SCRAPED },
      { name: 'image_source_page', label: 'Image source page', origin: ORIGIN.SCRAPED, type: 'url' },
    ],
  },
  {
    title: 'Product attributes',
    fields: [
      { name: 'tags', label: 'Tags', origin: ORIGIN.SCRAPED, list: true },
      { name: 'skills', label: 'Skills', origin: ORIGIN.SCRAPED, list: true },
      { name: 'features', label: 'Features', origin: ORIGIN.SCRAPED, list: true },
      { name: 'deployments', label: 'Deployments', origin: ORIGIN.SCRAPED, list: true },
      { name: 'platforms', label: 'Platforms', origin: ORIGIN.SCRAPED, list: true },
      { name: 'target_customers', label: 'Target customers', origin: ORIGIN.SCRAPED, list: true },
    ],
  },
]

export const ALL_FIELDS = FIELD_GROUPS.flatMap((group) => group.fields)
export const FIELD_BY_NAME = Object.fromEntries(ALL_FIELDS.map((field) => [field.name, field]))

export const EDITABLE_FIELDS = ALL_FIELDS.filter((f) => f.origin !== ORIGIN.GENERATED)
export const SCRAPED_FIELDS = ALL_FIELDS.filter((f) => f.origin === ORIGIN.SCRAPED)

// Same list as REQUIRED_FIELDS in server/src/services/ai/extraction.service.js.
// The backend re-checks on approval; this only drives what the UI flags.
export const REQUIRED_FIELDS = ALL_FIELDS.filter((f) => f.required).map((f) => f.name)

export const ORIGIN_LABEL = {
  [ORIGIN.SCRAPED]: 'From page',
  [ORIGIN.GENERATED]: 'Generated',
  [ORIGIN.ADMIN]: 'Admin entry',
}

export const SOURCE_TYPE_LABEL = {
  json_ld: 'Structured data (JSON-LD)',
  metadata: 'Page metadata',
  page_text: 'Page text',
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

export function isEmpty(value) {
  if (value === null || value === undefined) return true
  if (Array.isArray(value)) return value.length === 0
  return String(value).trim() === ''
}

export function missingRequired(product) {
  return REQUIRED_FIELDS.filter((name) => isEmpty(product?.[name]))
}

// Prisma Json columns may come back as arrays or as JSON strings.
export function toList(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/** Product -> form state (strings for inputs, one list item per line). */
export function toFormValues(product) {
  const values = {}
  for (const field of ALL_FIELDS) {
    const raw = product?.[field.name]
    if (field.list) values[field.name] = toList(raw).join('\n')
    else values[field.name] = raw === null || raw === undefined ? '' : String(raw)
  }
  return values
}

/** Form value -> value sent to the API. Blank becomes null. */
export function fromFormValue(field, value) {
  if (field.list) {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  const trimmed = String(value ?? '').trim()
  if (trimmed === '') return null
  if (field.type === 'number') {
    const number = Number(trimmed)
    return Number.isFinite(number) ? number : trimmed // let the backend reject it
  }
  return trimmed
}

export function formatValue(value) {
  if (isEmpty(value)) return ''
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

export function sameValue(a, b) {
  const norm = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).join('\n') : String(v ?? '').trim())
  return norm(a) === norm(b)
}
