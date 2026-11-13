import { SOURCE_TYPE_LABEL } from '../../utils/fields.js'
import { hostOf } from '../../utils/format.js'

/** One piece of evidence: where on the page a value came from. */
export function EvidenceQuote({ source }) {
  return (
    <figure className="rounded-md border-l-2 border-emerald-300 bg-emerald-50/50 py-1.5 pl-3 pr-2">
      <blockquote className="line-clamp-3 text-xs leading-relaxed text-stone-600" title={source.evidence_text}>
        “{source.evidence_text}”
      </blockquote>
      <figcaption className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-stone-400">
        <span>{SOURCE_TYPE_LABEL[source.source_type] ?? source.source_type ?? 'Page'}</span>
        {source.source_url && (
          <>
            <span aria-hidden="true">·</span>
            <a href={source.source_url} target="_blank" rel="noreferrer" className="hover:text-stone-700 hover:underline">
              {hostOf(source.source_url)} ↗
            </a>
          </>
        )}
      </figcaption>
    </figure>
  )
}

export function FieldNote({ tone = 'muted', children }) {
  const tones = {
    muted: 'text-stone-400',
    warning: 'text-amber-700',
    info: 'text-sky-700',
  }
  return <p className={`flex items-center gap-1.5 text-xs ${tones[tone]}`}>{children}</p>
}
