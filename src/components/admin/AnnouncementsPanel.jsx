import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  FileClock,
  History,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react'
import {
  ANNOUNCEMENT_ACCESS_TIERS,
  ANNOUNCEMENT_CHANNELS,
  ANNOUNCEMENT_PLATFORMS,
  ANNOUNCEMENT_SERVICE_SCOPES,
  ANNOUNCEMENT_SEVERITIES,
  AnnouncementApiError,
  archiveAnnouncement,
  createAnnouncementDraft,
  isHighImpact,
  listAnnouncementAudit,
  listAnnouncements,
  publishAnnouncement,
  updateAnnouncement,
} from '@/lib/adminAnnouncements'
import '@/styles/admin-announcements.css'

const STATUS_FILTERS = ['all', 'published', 'draft', 'archived']

function label(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function toLocalInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function fromLocalInput(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function formatDate(value) {
  if (!value) return 'No expiry'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Invalid date'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function emptyDraft() {
  return {
    severity: 'info',
    title: '',
    body: '',
    starts_at: toLocalInput(new Date().toISOString()),
    ends_at: '',
    platforms: ['all'],
    channels: ['beta'],
    min_version: '',
    max_version: '',
    access_tiers: [],
    service_scopes: ['terminal'],
    dismissible: true,
    requires_ack: false,
    action_label: '',
    action_url: '',
  }
}

function formFromAnnouncement(announcement) {
  return {
    severity: announcement.severity,
    title: announcement.title,
    body: announcement.body,
    starts_at: toLocalInput(announcement.starts_at),
    ends_at: toLocalInput(announcement.ends_at),
    platforms: announcement.platforms || ['all'],
    channels: announcement.channels || ['beta'],
    min_version: announcement.min_version || '',
    max_version: announcement.max_version || '',
    access_tiers: announcement.access_tiers || [],
    service_scopes: announcement.service_scopes || [],
    dismissible: announcement.dismissible,
    requires_ack: announcement.requires_ack,
    action_label: announcement.action_label || '',
    action_url: announcement.action_url || '',
  }
}

function payloadFromForm(form) {
  return {
    ...form,
    starts_at: fromLocalInput(form.starts_at),
    ends_at: fromLocalInput(form.ends_at),
    min_version: form.min_version.trim() || null,
    max_version: form.max_version.trim() || null,
    action_label: form.action_label.trim() || null,
    action_url: form.action_url.trim() || null,
  }
}

function arrayToggle(values, value, exclusive = null) {
  if (value === exclusive) return [exclusive]
  const withoutExclusive = values.filter((entry) => entry !== exclusive)
  return withoutExclusive.includes(value)
    ? withoutExclusive.filter((entry) => entry !== value)
    : [...withoutExclusive, value]
}

function StatusBadge({ status }) {
  return <span className={`announcement-status is-${status}`}>{status}</span>
}

function SeverityBadge({ severity }) {
  return <span className={`announcement-severity is-${severity}`}>{severity}</span>
}

function ConfirmationDialog({ state, busy, onCancel, onConfirm }) {
  const [typed, setTyped] = useState('')
  useEffect(() => setTyped(''), [state])
  if (!state) return null
  const valid = !state.requiredText || typed === state.requiredText

  return (
    <div className="announcement-dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="announcement-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <ShieldAlert size={22} />
        <div>
          <span className="announcement-eyebrow">CONFIRM ACTION</span>
          <h3 id="announcement-confirm-title">{state.title}</h3>
          <p>{state.message}</p>
          {state.requiredText && (
            <label>
              Type <strong>{state.requiredText}</strong> to continue
              <input value={typed} onChange={(event) => setTyped(event.target.value.toUpperCase())} autoFocus />
            </label>
          )}
          <div className="announcement-dialog-actions">
            <button type="button" className="announcement-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="button" className={state.danger ? 'announcement-danger' : 'announcement-primary'} onClick={() => onConfirm(typed)} disabled={!valid || busy}>
              {busy ? <Loader2 className="spin" size={15} /> : state.icon}
              {state.actionLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function ChoiceGroup({ label: groupLabel, values, options, onChange, exclusive, note }) {
  return (
    <fieldset className="announcement-choice-group">
      <legend>{groupLabel}</legend>
      <div>
        {options.map((option) => (
          <label key={option}>
            <input
              type="checkbox"
              checked={values.includes(option)}
              onChange={() => onChange(arrayToggle(values, option, exclusive))}
            />
            <span>{label(option)}</span>
          </label>
        ))}
      </div>
      {note && <small>{note}</small>}
    </fieldset>
  )
}

function Editor({ announcement, form, setForm, fieldError, busy, onClose, onSave }) {
  const published = announcement?.status === 'published'
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="announcement-editor-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="announcement-editor" role="dialog" aria-modal="true" aria-labelledby="announcement-editor-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="announcement-eyebrow">{published ? 'LIVE REVISION' : 'ANNOUNCEMENT DRAFT'}</span>
            <h2 id="announcement-editor-title">{announcement ? 'Edit announcement' : 'New announcement'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close editor" title="Close"><X size={18} /></button>
        </header>

        <form onSubmit={onSave}>
          <div className="announcement-editor-grid">
            <label className={fieldError === 'severity' ? 'has-error' : ''}>
              Severity
              <select value={form.severity} onChange={(event) => set('severity', event.target.value)}>
                {ANNOUNCEMENT_SEVERITIES.map((severity) => <option key={severity} value={severity}>{label(severity)}</option>)}
              </select>
            </label>
            <label className={fieldError === 'title' ? 'has-error announcement-span-2' : 'announcement-span-2'}>
              Title
              <input value={form.title} onChange={(event) => set('title', event.target.value)} maxLength={120} placeholder="Short, specific heading" />
              <small>{form.title.length}/120</small>
            </label>
            <label className={fieldError === 'body' ? 'has-error announcement-span-3' : 'announcement-span-3'}>
              Message
              <textarea value={form.body} onChange={(event) => set('body', event.target.value)} maxLength={4000} rows={7} placeholder="Plain text shown in the terminal." />
              <small>{form.body.length}/4000. HTML and Markdown are not supported.</small>
            </label>

            <label className={fieldError === 'starts_at' ? 'has-error' : ''}>
              Starts
              <input type="datetime-local" value={form.starts_at} onChange={(event) => set('starts_at', event.target.value)} />
              <small>{fromLocalInput(form.starts_at) || 'Choose a valid time'} UTC</small>
            </label>
            <label className={fieldError === 'ends_at' ? 'has-error' : ''}>
              Ends
              <input type="datetime-local" value={form.ends_at} onChange={(event) => set('ends_at', event.target.value)} />
              <small>{form.ends_at ? `${fromLocalInput(form.ends_at)} UTC` : 'No automatic expiry'}</small>
            </label>
            <div className="announcement-preview">
              <span>Client preview</span>
              <SeverityBadge severity={form.severity} />
              <strong>{form.title || 'Announcement title'}</strong>
              <p>{form.body || 'Announcement message'}</p>
            </div>

            <ChoiceGroup label="Platforms" values={form.platforms} options={ANNOUNCEMENT_PLATFORMS} exclusive="all" onChange={(values) => set('platforms', values)} />
            <ChoiceGroup label="Channels" values={form.channels} options={ANNOUNCEMENT_CHANNELS} onChange={(values) => set('channels', values)} />
            <ChoiceGroup label="Service scope" values={form.service_scopes} options={ANNOUNCEMENT_SERVICE_SCOPES} exclusive="all" onChange={(values) => set('service_scopes', values)} note="Informational targeting only. This does not disable a service." />
            <ChoiceGroup label="Access tiers" values={form.access_tiers} options={ANNOUNCEMENT_ACCESS_TIERS} onChange={(values) => set('access_tiers', values)} note="No selection means every authenticated tier." />

            <label className={fieldError === 'min_version' ? 'has-error' : ''}>
              Minimum version
              <input value={form.min_version} onChange={(event) => set('min_version', event.target.value)} placeholder="0.2.0-beta.1" />
            </label>
            <label className={fieldError === 'max_version' ? 'has-error' : ''}>
              Maximum version
              <input value={form.max_version} onChange={(event) => set('max_version', event.target.value)} placeholder="Optional" />
            </label>
            <div className="announcement-switches">
              <label>
                <input type="checkbox" checked={form.dismissible} disabled={form.requires_ack} onChange={(event) => set('dismissible', event.target.checked)} />
                <span>Dismissible</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.requires_ack}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    requires_ack: event.target.checked,
                    dismissible: event.target.checked ? false : current.dismissible,
                  }))}
                />
                <span>Requires acknowledgement</span>
              </label>
            </div>

            <label className={fieldError === 'action_label' ? 'has-error' : ''}>
              Action label
              <input value={form.action_label} onChange={(event) => set('action_label', event.target.value)} maxLength={40} placeholder="Read release notes" />
            </label>
            <label className={fieldError === 'action_url' ? 'has-error announcement-span-2' : 'announcement-span-2'}>
              Action URL
              <input type="url" value={form.action_url} onChange={(event) => set('action_url', event.target.value)} placeholder="https://www.tradenet.org/docs/..." />
            </label>
          </div>

          {fieldError && <p className="announcement-form-error">Review the highlighted field before saving.</p>}
          <footer>
            <button type="button" className="announcement-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="announcement-primary" disabled={busy}>
              {busy ? <Loader2 className="spin" size={15} /> : <Check size={15} />}
              {published ? 'Save live revision' : 'Save draft'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function AuditDrawer({ announcement, entries, loading, onClose }) {
  return (
    <aside className="announcement-audit" aria-label="Announcement audit history">
      <header>
        <div>
          <span className="announcement-eyebrow">IMMUTABLE AUDIT</span>
          <h3>{announcement.title}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close audit history"><X size={17} /></button>
      </header>
      {loading && <div className="announcement-empty"><Loader2 className="spin" size={20} /> Loading history</div>}
      {!loading && entries.length === 0 && <div className="announcement-empty">No audit events are available.</div>}
      <ol>
        {entries.map((entry) => (
          <li key={entry.id}>
            <i />
            <div>
              <strong>{label(entry.action)}</strong>
              <span>Revision {entry.from_revision || 0} to {entry.to_revision}</span>
              <small>{formatDate(entry.created_at)} | actor {String(entry.actor_id).slice(0, 8)}</small>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  )
}

export default function AnnouncementsPanel() {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState(null)
  const [form, setForm] = useState(emptyDraft)
  const [confirmation, setConfirmation] = useState(null)
  const [audit, setAudit] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await listAnnouncements('all')
      setAnnouncements(result?.announcements || [])
    } catch (loadError) {
      setError(loadError?.message || 'Announcements could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => ({
    all: announcements.length,
    published: announcements.filter((item) => item.status === 'published').length,
    draft: announcements.filter((item) => item.status === 'draft').length,
    archived: announcements.filter((item) => item.status === 'archived').length,
  }), [announcements])

  const visible = useMemo(() => announcements.filter((announcement) => {
    if (statusFilter !== 'all' && announcement.status !== statusFilter) return false
    if (!search.trim()) return true
    const query = search.trim().toLowerCase()
    return announcement.title.toLowerCase().includes(query) || announcement.body.toLowerCase().includes(query)
  }), [announcements, search, statusFilter])

  function openNew() {
    setEditor({ announcement: null })
    setForm(emptyDraft())
    setFieldError(null)
  }

  function openEdit(announcement) {
    setEditor({ announcement })
    setForm(formFromAnnouncement(announcement))
    setFieldError(null)
  }

  async function run(task, closeEditor = false) {
    setBusy(true)
    setError('')
    setFieldError(null)
    try {
      await task()
      if (closeEditor) setEditor(null)
      setConfirmation(null)
      await load()
    } catch (actionError) {
      if (actionError instanceof AnnouncementApiError) {
        setFieldError(actionError.field)
        setError(actionError.message)
      } else {
        setError(actionError?.message || 'The announcement action failed.')
      }
    } finally {
      setBusy(false)
    }
  }

  function save(event) {
    event.preventDefault()
    const payload = payloadFromForm(form)
    if (!editor.announcement) {
      run(() => createAnnouncementDraft(payload), true)
      return
    }
    if (editor.announcement.status === 'published') {
      setConfirmation({
        kind: 'update',
        announcement: editor.announcement,
        payload,
        title: 'Publish this revised announcement?',
        message: 'Saving changes to a live announcement creates a new revision and makes it reappear for clients that dismissed the previous revision.',
        requiredText: 'PUBLISH',
        actionLabel: 'Publish revision',
        icon: <Send size={15} />,
      })
      return
    }
    run(() => updateAnnouncement(editor.announcement, payload), true)
  }

  function requestPublish(announcement) {
    const highImpact = isHighImpact(announcement)
    setConfirmation({
      kind: 'publish',
      announcement,
      title: 'Publish this announcement?',
      message: highImpact
        ? 'This notice is high impact and will be delivered to every matching active client.'
        : 'Matching clients will receive this announcement after the authoritative snapshot refreshes.',
      requiredText: highImpact ? 'PUBLISH' : null,
      actionLabel: 'Publish',
      icon: <Send size={15} />,
    })
  }

  function requestArchive(announcement) {
    const highImpact = announcement.status === 'published' && ['critical', 'maintenance'].includes(announcement.severity)
    setConfirmation({
      kind: 'archive',
      announcement,
      title: 'Archive this announcement?',
      message: announcement.status === 'published'
        ? 'It will disappear from the next client snapshot and remain in immutable audit history.'
        : 'The draft will be closed and retained in audit history.',
      requiredText: highImpact ? 'ARCHIVE' : null,
      actionLabel: 'Archive',
      danger: true,
      icon: <Archive size={15} />,
    })
  }

  function confirmAction(typed) {
    const state = confirmation
    if (state.kind === 'publish') {
      run(() => publishAnnouncement(state.announcement, typed || null))
    } else if (state.kind === 'archive') {
      run(() => archiveAnnouncement(state.announcement, typed || null))
    } else {
      run(() => updateAnnouncement(state.announcement, state.payload, typed), true)
    }
  }

  async function openAudit(announcement) {
    setAudit({ announcement, entries: [], loading: true })
    try {
      const result = await listAnnouncementAudit(announcement.id)
      setAudit({ announcement, entries: result?.audit || [], loading: false })
    } catch (auditError) {
      setAudit(null)
      setError(auditError?.message || 'Audit history could not be loaded.')
    }
  }

  return (
    <div className="announcement-admin">
      <header className="announcement-page-heading">
        <div>
          <span className="announcement-eyebrow">CLIENT COMMUNICATIONS</span>
          <h1>Announcements</h1>
          <p>Authoritative notices for authenticated TradeNet web and desktop clients.</p>
        </div>
        <div>
          <button type="button" className="announcement-secondary" onClick={load} disabled={loading} title="Refresh announcements">
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button type="button" className="announcement-primary" onClick={openNew}>
            <Plus size={15} /> New announcement
          </button>
        </div>
      </header>

      <div className="announcement-metrics">
        <div><Megaphone size={16} /><span>Published<strong>{counts.published}</strong></span></div>
        <div><FileClock size={16} /><span>Drafts<strong>{counts.draft}</strong></span></div>
        <div><Archive size={16} /><span>Archived<strong>{counts.archived}</strong></span></div>
        <div><CalendarClock size={16} /><span>Total revisions<strong>{announcements.reduce((sum, item) => sum + item.revision, 0)}</strong></span></div>
      </div>

      <div className="announcement-toolbar">
        <div>
          {STATUS_FILTERS.map((status) => (
            <button key={status} type="button" className={statusFilter === status ? 'active' : ''} onClick={() => setStatusFilter(status)}>
              {label(status)} <span>{counts[status]}</span>
            </button>
          ))}
        </div>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search announcements" aria-label="Search announcements" />
      </div>

      {error && <div className="announcement-error" role="alert"><ShieldAlert size={16} />{error}</div>}
      {loading && <div className="announcement-empty"><Loader2 className="spin" size={20} /> Loading announcements</div>}
      {!loading && visible.length === 0 && (
        <div className="announcement-empty">
          <Megaphone size={24} />
          <strong>No matching announcements</strong>
          <span>Create a draft or change the current filter.</span>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="announcement-list">
          {visible.map((announcement) => (
            <article key={announcement.id}>
              <div className={`announcement-list-accent is-${announcement.severity}`} />
              <div className="announcement-list-main">
                <div className="announcement-list-title">
                  <SeverityBadge severity={announcement.severity} />
                  <StatusBadge status={announcement.status} />
                  {announcement.requires_ack && <span className="announcement-ack">ACK REQUIRED</span>}
                  <strong>{announcement.title}</strong>
                </div>
                <p>{announcement.body}</p>
                <div className="announcement-list-meta">
                  <span><Clock3 size={13} />{formatDate(announcement.starts_at)}</span>
                  <span>Revision {announcement.revision}</span>
                  <span>{announcement.channels.join(', ')}</span>
                  <span>{announcement.platforms.join(', ')}</span>
                </div>
              </div>
              <div className="announcement-list-actions">
                {announcement.status !== 'archived' && (
                  <button type="button" onClick={() => openEdit(announcement)} title="Edit" aria-label={`Edit ${announcement.title}`}><Pencil size={15} /></button>
                )}
                {announcement.status === 'draft' && (
                  <button type="button" onClick={() => requestPublish(announcement)} title="Publish" aria-label={`Publish ${announcement.title}`}><Send size={15} /></button>
                )}
                <button type="button" onClick={() => openAudit(announcement)} title="Audit history" aria-label={`Audit history for ${announcement.title}`}><History size={15} /></button>
                {announcement.status !== 'archived' && (
                  <button type="button" className="is-danger" onClick={() => requestArchive(announcement)} title="Archive" aria-label={`Archive ${announcement.title}`}><Archive size={15} /></button>
                )}
                <ChevronRight size={15} aria-hidden="true" />
              </div>
            </article>
          ))}
        </div>
      )}

      {editor && (
        <Editor
          announcement={editor.announcement}
          form={form}
          setForm={setForm}
          fieldError={fieldError}
          busy={busy}
          onClose={() => !busy && setEditor(null)}
          onSave={save}
        />
      )}
      <ConfirmationDialog state={confirmation} busy={busy} onCancel={() => !busy && setConfirmation(null)} onConfirm={confirmAction} />
      {audit && <AuditDrawer {...audit} onClose={() => setAudit(null)} />}
    </div>
  )
}
