// /admin/marketing — las respuestas de las encuestas de marketing, una pestaña por encuesta
// (Psicólogos, Especialistas, Médico General), con búsqueda por correo, rango de fechas y
// exportación a Excel.
//
// Solo super_admin: el backend lo exige con el permiso `marketing.read`, sembrado para ese único
// rol, y aquí se refleja para no ofrecer una página que solo puede dar 403 (mismo criterio que
// /admin/reportes, cuya tabla genérica reutiliza).
import { useEffect, useState } from 'react'
import AdminLayout, { AdminLoading } from '../../components/admin/AdminLayout'
import ReportTable from '../../components/admin/ReportTable'
import { getAccessToken, useAdminGuard } from '../../lib/admin'
import { ApiError } from '../../lib/apiClient'
import {
  downloadSurveyResponses,
  fetchSurveyResponses,
  SurveyResponseFilters,
  SurveySlug
} from '../../lib/marketing'
import type { ReportPreview } from '../../lib/reports'

const PAGE_SIZE = 25

const TABS: { slug: SurveySlug; label: string; hint: string }[] = [
  {
    slug: 'psicologos',
    label: 'Psicólogos',
    hint: 'Cómo quieren participar, su disponibilidad y desde dónde se conectan.'
  },
  {
    slug: 'especialistas',
    label: 'Especialistas',
    hint: 'Cómo quieren participar, su disponibilidad y desde dónde se conectan.'
  },
  {
    slug: 'medicos-generales',
    label: 'Médico General',
    hint: 'Cómo quieren participar y, si van a atender o asumir un rol, su disponibilidad.'
  }
]

// Variable de Kit que se reemplaza por el correo de cada destinatario. Si el envío masivo se hace
// con otra herramienta, cambia la sintaxis de la variable, no el resto del enlace.
const KIT_EMAIL_VARIABLE = '{{ subscriber.email_address }}'

export default function AdminMarketing() {
  const { profile, loading } = useAdminGuard()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [survey, setSurvey] = useState<SurveySlug>('psicologos')
  const [filters, setFilters] = useState<SurveyResponseFilters>({})
  const [searchDraft, setSearchDraft] = useState('')
  const [page, setPage] = useState(0)
  const [preview, setPreview] = useState<ReportPreview | null>(null)
  // Un estado de error por fuente: el fallo de la lista y el de la exportación se recuperan
  // distinto (reintentar vs acotar el filtro) y uno no debe borrar el aviso del otro.
  const [previewError, setPreviewError] = useState('')
  const [exportError, setExportError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState('')
  const [copied, setCopied] = useState(false)

  // `search` con debounce para no lanzar una consulta por tecla.
  useEffect(() => {
    const t = setTimeout(() => setFilter('search', searchDraft), 300)
    return () => clearTimeout(t)
  }, [searchDraft])

  function setFilter(key: keyof SurveyResponseFilters, value: string) {
    setFilters((prev) => {
      // Devolver `prev` si nada cambia: `filters` es dependencia de la carga, y un objeto nuevo
      // con el mismo contenido volvería a pedir la lista (el debounce llama aquí al montar).
      if ((prev[key] ?? '') === value) return prev
      const next = { ...prev }
      if (value === '') delete next[key]
      else next[key] = value
      return next
    })
    setPage(0)
  }

  // Cambiar de encuesta conserva los filtros: son los mismos en las tres (correo y fechas), y
  // buscar a una persona en las tres pestañas es justo el uso esperado.
  function switchSurvey(next: SurveySlug) {
    setSurvey(next)
    setPage(0)
    setPreview(null)
    setExported('')
    setExportError('')
    setCopied(false)
  }

  function clearFilters() {
    setFilters({})
    setSearchDraft('')
    setPage(0)
  }

  // (Re)carga la lista cuando cambian la encuesta, los filtros o la página. `cancelled` descarta
  // la respuesta de una petición que ya no corresponde: al saltar rápido entre pestañas, la de la
  // anterior podía llegar después y pintar sus filas bajo el título de la nueva.
  useEffect(() => {
    if (!isSuperAdmin) return
    let cancelled = false
    ;(async () => {
      setPreviewLoading(true)
      setPreviewError('')
      try {
        const data = await fetchSurveyResponses(
          survey,
          filters,
          { skip: page * PAGE_SIZE, limit: PAGE_SIZE },
          await getAccessToken()
        )
        if (!cancelled) setPreview(data)
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setPreviewError(
            e instanceof ApiError ? e.message : 'No se pudieron cargar las respuestas.'
          )
          setPreview(null)
        }
      }
      if (!cancelled) setPreviewLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [isSuperAdmin, survey, filters, page])

  async function onExport() {
    setExporting(true)
    setExportError('')
    setExported('')
    try {
      setExported(await downloadSurveyResponses(survey, filters, await getAccessToken()))
    } catch (e) {
      console.error(e)
      setExportError(e instanceof ApiError ? e.message : 'No se pudieron exportar las respuestas.')
    }
    setExporting(false)
  }

  if (loading) return <AdminLoading />

  if (!isSuperAdmin) {
    return (
      <AdminLayout title="Marketing" profile={profile}>
        <div className="notice notice-warning">
          Las respuestas de las encuestas de marketing incluyen el correo de cada médico que
          respondió, así que están reservadas a los <strong>super administradores</strong>. Si
          necesitas una, pídesela a un super administrador.
        </div>
      </AdminLayout>
    )
  }

  const tab = TABS.find((t) => t.slug === survey)!
  const total = preview?.total ?? 0
  const activeFilters = preview?.filters ?? []
  const hasFilters = Object.keys(filters).length > 0
  const surveyLink = `${window.location.origin}/encuesta/${survey}?email=${KIT_EMAIL_VARIABLE}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(surveyLink)
      setCopied(true)
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS en local): el enlace sigue a la vista para
      // copiarlo a mano, así que no hace falta un aviso de error.
    }
  }

  return (
    <AdminLayout title="Marketing" profile={profile}>
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="tag-row" role="tablist" aria-label="Encuestas" style={{ marginBottom: 12 }}>
          {TABS.map((t) => (
            <button
              key={t.slug}
              type="button"
              role="tab"
              id={`tab-${t.slug}`}
              aria-selected={survey === t.slug}
              aria-controls="panel-encuesta"
              className={`btn ${survey === t.slug ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => switchSurvey(t.slug)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>{tab.hint}</p>
      </section>

      <div role="tabpanel" id="panel-encuesta" aria-labelledby={`tab-${survey}`}>
        <section className="card" style={{ marginBottom: 18 }}>
          <h2 style={{ marginTop: 0 }}>Enlace para el correo masivo</h2>
          <p style={{ marginTop: 0, color: '#64748b', fontSize: 14 }}>
            Pégalo tal cual en el botón del correo de Kit: Kit reemplaza{' '}
            <code>{KIT_EMAIL_VARIABLE}</code> por el correo de cada destinatario, y el formulario lo
            muestra ya escrito.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <input
              readOnly
              value={surveyLink}
              aria-label="Enlace de la encuesta"
              style={{ flex: '1 1 320px', fontFamily: 'monospace', fontSize: 13 }}
              onFocus={(e) => e.target.select()}
            />
            <button type="button" className="btn btn-outline" onClick={copyLink}>
              {copied ? 'Copiado' : 'Copiar enlace'}
            </button>
          </div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <h2 style={{ marginTop: 0 }}>Filtros</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <input
              style={{ flex: '1 1 220px' }}
              placeholder="Buscar por correo"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
            />
            <input
              type="date"
              style={{ flex: '0 1 150px' }}
              value={filters.answered_from ?? ''}
              onChange={(e) => setFilter('answered_from', e.target.value)}
              title="Respondieron desde (inclusive)"
              aria-label="Respondieron desde"
            />
            <input
              type="date"
              style={{ flex: '0 1 150px' }}
              value={filters.answered_to ?? ''}
              onChange={(e) => setFilter('answered_to', e.target.value)}
              title="Respondieron hasta (inclusive)"
              aria-label="Respondieron hasta"
            />
            <button type="button" className="btn btn-muted" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>

          {activeFilters.length > 0 && (
            <div className="tag-row" style={{ marginTop: 12 }}>
              {activeFilters.map(([label, value]) => (
                <span key={label} className="badge badge-blue">
                  {label}: {value}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 12
            }}
          >
            <h2 style={{ margin: 0 }}>
              Respuestas{' '}
              <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 14 }}>
                ({total} {total === 1 ? 'respuesta' : 'respuestas'})
              </span>
            </h2>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onExport}
              disabled={exporting || previewLoading || total === 0}
            >
              {exporting ? 'Generando Excel...' : `Exportar a Excel (${total})`}
            </button>
          </div>

          <p style={{ marginTop: 0, color: '#64748b', fontSize: 13 }}>
            Una fila por persona: si alguien responde de nuevo, su respuesta se actualiza. La tabla
            muestra {Math.min(PAGE_SIZE, total)} de {total}; el Excel incluye <strong>todas</strong>{' '}
            las que cumplen estos filtros.
          </p>

          {previewError && (
            <div className="notice notice-danger" style={{ marginBottom: 12 }}>
              {previewError}
            </div>
          )}
          {exportError && (
            <div className="notice notice-danger" style={{ marginBottom: 12 }}>
              {exportError}
            </div>
          )}
          {exported && !exportError && (
            <div className="notice notice-success" style={{ marginBottom: 12 }}>
              Respuestas descargadas como <strong>{exported}</strong>.
            </div>
          )}

          <ReportTable
            preview={preview}
            loading={previewLoading}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            emptyText={
              hasFilters
                ? 'Ninguna respuesta coincide con estos filtros.'
                : 'Todavía no hay respuestas en esta encuesta.'
            }
            rowKey={(row, i) => String(row.email || i)}
            wrapText
          />
        </section>
      </div>
    </AdminLayout>
  )
}
