// /admin/marketing — las respuestas de las encuestas de marketing: una pestaña por encuesta
// (Psicólogos, Especialistas, Médico General) con el total de respuestas en su nombre, búsqueda
// por correo, rango de fechas y exportación a Excel, y una pestaña de Gráficos para decidir con
// las respuestas agregadas.
//
// Solo super_admin: el backend lo exige con el permiso `marketing.read`, sembrado para ese único
// rol, y aquí se refleja para no ofrecer una página que solo puede dar 403 (mismo criterio que
// /admin/reportes, cuya tabla genérica reutiliza).
import { useEffect, useState } from 'react'
import AdminLayout, { AdminLoading } from '../../components/admin/AdminLayout'
import ReportTable from '../../components/admin/ReportTable'
import SurveyCharts from '../../components/admin/SurveyCharts'
import { getAccessToken, useAdminGuard } from '../../lib/admin'
import { ApiError } from '../../lib/apiClient'
import {
  downloadSurveyResponses,
  fetchSurveyResponses,
  fetchSurveyTotals,
  SurveyResponseFilters,
  SurveySlug
} from '../../lib/marketing'
import type { ReportPreview } from '../../lib/reports'

const PAGE_SIZE = 25

const SURVEY_TABS: { slug: SurveySlug; label: string; hint: string }[] = [
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

const CHARTS_TAB = 'graficos'
const CHARTS_HINT =
  'Las respuestas agregadas para decidir: cuándo hay cobertura, cuántas horas ofrecen, cómo quieren participar y desde dónde se conectan.'

type Tab = SurveySlug | typeof CHARTS_TAB

export default function AdminMarketing() {
  const { profile, loading } = useAdminGuard()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [tab, setTab] = useState<Tab>('psicologos')
  // La última encuesta abierta: la lista la usa, y los gráficos abren con ella.
  const [survey, setSurvey] = useState<SurveySlug>('psicologos')
  const [totals, setTotals] = useState<Partial<Record<SurveySlug, number>>>({})
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

  // `search` con debounce para no lanzar una consulta por tecla.
  useEffect(() => {
    const t = setTimeout(() => setFilter('search', searchDraft), 300)
    return () => clearTimeout(t)
  }, [searchDraft])

  // El número de cada pestaña, sin filtros. Si falla, las pestañas salen sin número: no bloquea
  // nada, así que no merece un aviso que tape la lista.
  useEffect(() => {
    if (!isSuperAdmin) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchSurveyTotals(await getAccessToken())
        if (!cancelled) setTotals(Object.fromEntries(data.map((t) => [t.survey, t.total])))
      } catch (e) {
        console.error(e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isSuperAdmin])

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
  function switchTab(next: Tab) {
    setTab(next)
    if (next === CHARTS_TAB || next === survey) return
    setSurvey(next)
    setPage(0)
    setPreview(null)
    setExported('')
    setExportError('')
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
    if (!isSuperAdmin || tab === CHARTS_TAB) return
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
  }, [isSuperAdmin, tab, survey, filters, page])

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

  const surveyTab = SURVEY_TABS.find((t) => t.slug === survey)!
  const total = preview?.total ?? 0
  const activeFilters = preview?.filters ?? []
  const hasFilters = Object.keys(filters).length > 0
  const tabs: { slug: Tab; label: string }[] = [
    ...SURVEY_TABS.map((t) => ({
      slug: t.slug,
      label: totals[t.slug] === undefined ? t.label : `${t.label} (${totals[t.slug]})`
    })),
    { slug: CHARTS_TAB, label: 'Gráficos' }
  ]

  return (
    <AdminLayout title="Marketing" profile={profile}>
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="tag-row" role="tablist" aria-label="Encuestas" style={{ marginBottom: 12 }}>
          {tabs.map((t) => (
            <button
              key={t.slug}
              type="button"
              role="tab"
              id={`tab-${t.slug}`}
              aria-selected={tab === t.slug}
              aria-controls="panel-marketing"
              className={`btn ${tab === t.slug ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => switchTab(t.slug)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
          {tab === CHARTS_TAB ? CHARTS_HINT : surveyTab.hint}
        </p>
      </section>

      <div role="tabpanel" id="panel-marketing" aria-labelledby={`tab-${tab}`}>
        {tab === CHARTS_TAB ? (
          <SurveyCharts surveys={SURVEY_TABS} initialSurvey={survey} />
        ) : (
          <>
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
                Una fila por persona: si alguien responde de nuevo, su respuesta se actualiza. La
                tabla muestra {Math.min(PAGE_SIZE, total)} de {total}; el Excel incluye{' '}
                <strong>todas</strong> las que cumplen estos filtros.
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
          </>
        )}
      </div>
    </AdminLayout>
  )
}
