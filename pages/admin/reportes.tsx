// /admin/reportes — reportes de listado de médicos y pacientes, filtrables y exportables a
// Excel. Solo super_admin (el backend lo exige con el permiso `reports.export`, sembrado para
// ese único rol; acá se refleja para no ofrecer un botón que va a dar 403).
//
// La tabla se pinta de forma GENÉRICA desde las `columns` que manda el backend, no con un JSX
// por campo: es lo que garantiza que la vista previa y el .xlsx tengan las mismas columnas, y
// que añadir un dato al reporte no requiera tocar esta página.
import { useEffect, useMemo, useState } from 'react'
import AdminLayout, { AdminLoading } from '../../components/admin/AdminLayout'
import { fetchAffectedZoneCatalog } from '../../lib/api'
import { ApiError } from '../../lib/apiClient'
import { getAccessToken, useAdminGuard } from '../../lib/admin'
import {
  fetchProfessionalTypes,
  fetchSpecialties,
  ProfessionalTypeResponse,
  SpecialtyResponse
} from '../../lib/doctors'
import {
  downloadReport,
  fetchReportPreview,
  ReportFilters,
  ReportKind,
  ReportPreview
} from '../../lib/reports'
import { useMountEffect } from '../../lib/hooks'

const PAGE_SIZE = 25

const KINDS: { key: ReportKind; label: string; hint: string }[] = [
  {
    key: 'doctors',
    label: 'Médicos',
    hint: 'Ficha, credencial (habilitado para atender y por qué no) y actividad de cada médico.'
  },
  {
    key: 'patients',
    label: 'Pacientes',
    hint: 'Ficha, origen (cola pública o consultorio), consentimiento y estado de sus casos.'
  }
]

// Los motivos de bloqueo del backend (`services/doctors._blocked_reason`), con la etiqueta que
// ve el admin. Mismo criterio que el gate real de acceso de los médicos.
const BLOCKED_REASONS: [string, string][] = [
  ['sin_ficha', 'Sin ficha de médico'],
  ['de_baja', 'Ficha de baja o expulsada'],
  ['sin_cedula', 'Sin cédula'],
  ['sin_licencia', 'Sin licencia'],
  ['no_verificado', 'Credencial no verificada']
]

// Los rangos que ofrece el registro de pacientes. Se escriben tal cual en `patients.age_range`,
// así que el filtro es por igualdad exacta contra estos valores.
const AGE_RANGES = ['0-11', '12-17', '18-29', '30-39', '40-49', '50-59', '60-69', '70+']

// Las fechas llegan del backend YA convertidas a hora de Venezuela y SIN zona (un ISO naive,
// p. ej. "2026-09-03T14:30:00"). Se formatean como texto a propósito: pasarlas por `new Date()`
// haría que el navegador las interprete como hora local del equipo y volviera a desplazarlas —
// un admin en España vería +6 horas sobre la hora que dice el Excel del mismo reporte.
function fmtNaive(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!m) return value
  const [, y, mo, d, hh, mm] = m
  return `${d}/${mo}/${y} ${hh}:${mm}`
}

function cellText(value: string | number | null | undefined, kind: 'text' | 'datetime'): string {
  if (value === null || value === undefined || value === '') return '—'
  if (kind === 'datetime' && typeof value === 'string') return fmtNaive(value)
  return String(value)
}

export default function AdminReportes() {
  const { profile, loading } = useAdminGuard()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [kind, setKind] = useState<ReportKind>('doctors')
  const [filters, setFilters] = useState<ReportFilters>({})
  const [page, setPage] = useState(0)
  const [preview, setPreview] = useState<ReportPreview | null>(null)
  // Un estado de error por fuente: el fallo de la vista previa y el de la exportación tienen
  // recuperaciones distintas (reintentar vs acotar el filtro), así que compartir un `error`
  // haría que uno borrara el aviso del otro.
  const [previewError, setPreviewError] = useState('')
  const [exportError, setExportError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState('')

  // Catálogos de los selectores (especialidad, tipo profesional, zona). Su fallo es
  // independiente del de la lista: sin catálogos el reporte sigue siendo usable con el resto
  // de los filtros, así que no bloquea ni pisa el error de la tabla.
  const [specialties, setSpecialties] = useState<SpecialtyResponse[]>([])
  const [types, setTypes] = useState<ProfessionalTypeResponse[]>([])
  const [zones, setZones] = useState<string[]>([])

  // `search` con debounce para no lanzar una consulta por tecla.
  const [searchDraft, setSearchDraft] = useState('')

  useMountEffect(() => {
    ;(async () => {
      const [spec, ptypes, zoneNames] = await Promise.all([
        fetchSpecialties().catch(() => []),
        fetchProfessionalTypes().catch(() => []),
        fetchAffectedZoneCatalog().catch(() => [])
      ])
      setSpecialties(spec)
      setTypes(ptypes)
      setZones(zoneNames)
    })()
  })

  useEffect(() => {
    const t = setTimeout(() => setFilter('search', searchDraft), 300)
    return () => clearTimeout(t)
  }, [searchDraft])

  // Cambiar de reporte descarta los filtros: los de médicos (credencial, especialidad) no
  // existen en pacientes, y arrastrarlos daría un 422 o, peor, un filtro invisible que el
  // usuario no puede ver ni quitar en el formulario nuevo.
  function switchKind(next: ReportKind) {
    setKind(next)
    setFilters({})
    setSearchDraft('')
    setPage(0)
    setPreview(null)
    setExported('')
  }

  function setFilter(key: keyof ReportFilters, value: string) {
    setFilters((prev) => {
      // Devolver `prev` cuando nada cambia no es una micro-optimización: `filters` es una
      // dependencia del efecto que carga la vista previa, así que un objeto nuevo con el mismo
      // contenido dispara otra consulta. El debounce del buscador llama aquí al montar con la
      // cadena vacía, y sin esta guarda la página pediría el reporte dos veces de entrada.
      const current = prev[key] ?? ''
      if (current === value) return prev
      const next = { ...prev }
      if (value === '') delete next[key]
      else next[key] = value
      return next
    })
    setPage(0)
  }

  function clearFilters() {
    setFilters({})
    setSearchDraft('')
    setPage(0)
  }

  // (Re)carga la vista previa cuando cambian el reporte, los filtros o la página.
  useEffect(() => {
    if (!isSuperAdmin) return
    ;(async () => {
      setPreviewLoading(true)
      setPreviewError('')
      try {
        const data = await fetchReportPreview(
          kind,
          filters,
          { skip: page * PAGE_SIZE, limit: PAGE_SIZE },
          await getAccessToken()
        )
        setPreview(data)
      } catch (e) {
        console.error(e)
        setPreviewError(
          e instanceof ApiError ? e.message : 'No se pudo cargar la vista previa del reporte.'
        )
        setPreview(null)
      }
      setPreviewLoading(false)
    })()
  }, [isSuperAdmin, kind, filters, page])

  async function onExport() {
    setExporting(true)
    setExportError('')
    setExported('')
    try {
      const name = await downloadReport(kind, filters, await getAccessToken())
      setExported(name)
    } catch (e) {
      console.error(e)
      // El backend manda un 422 con el motivo cuando el filtro es demasiado amplio; su mensaje
      // dice qué hacer, así que se muestra tal cual en vez de un genérico.
      setExportError(e instanceof ApiError ? e.message : 'No se pudo exportar el reporte.')
    }
    setExporting(false)
  }

  const total = preview?.total ?? 0
  const activeFilters = preview?.filters ?? []
  const columns = preview?.columns ?? []
  const kindMeta = useMemo(() => KINDS.find((k) => k.key === kind)!, [kind])

  if (loading) return <AdminLoading />

  if (!isSuperAdmin) {
    return (
      <AdminLayout title="Reportes" profile={profile}>
        <div className="notice notice-warning">
          Los reportes exportan la ficha completa de médicos y pacientes (cédulas, teléfonos,
          alergias), así que están reservados a los <strong>super administradores</strong>. Si
          necesitas uno, pídelo a un super administrador.
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Reportes" profile={profile}>
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="tag-row" style={{ marginBottom: 12 }}>
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              className={`btn ${kind === k.key ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => switchKind(k.key)}
              aria-pressed={kind === k.key}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>{kindMeta.hint}</p>
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Filtros</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input
            style={{ flex: '1 1 220px' }}
            placeholder={
              kind === 'doctors'
                ? 'Buscar nombre, cédula o email'
                : 'Buscar nombre, cédula, email o teléfono'
            }
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />

          {kind === 'doctors' ? (
            <>
              <select
                style={{ flex: '0 1 170px' }}
                value={filters.status ?? ''}
                onChange={(e) => setFilter('status', e.target.value)}
                aria-label="Estado de la ficha"
              >
                <option value="">Todos los estados</option>
                <option value="1">Activos</option>
                <option value="0">De baja</option>
                <option value="2">Expulsados</option>
              </select>
              <select
                style={{ flex: '0 1 200px' }}
                value={filters.can_practice ?? ''}
                onChange={(e) => setFilter('can_practice', e.target.value)}
                aria-label="Habilitación para atender"
              >
                <option value="">Habilitados y bloqueados</option>
                <option value="true">Solo habilitados para atender</option>
                <option value="false">Solo bloqueados</option>
              </select>
              <select
                style={{ flex: '0 1 200px' }}
                value={filters.blocked_reason ?? ''}
                onChange={(e) => setFilter('blocked_reason', e.target.value)}
                aria-label="Motivo de bloqueo"
              >
                <option value="">Cualquier motivo de bloqueo</option>
                {BLOCKED_REASONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                style={{ flex: '0 1 190px' }}
                value={filters.verified ?? ''}
                onChange={(e) => setFilter('verified', e.target.value)}
                aria-label="Credencial verificada"
              >
                <option value="">Credencial: cualquiera</option>
                <option value="true">Credencial verificada</option>
                <option value="false">Credencial sin verificar</option>
              </select>
              <select
                style={{ flex: '0 1 190px' }}
                value={filters.specialty_id ?? ''}
                onChange={(e) => setFilter('specialty_id', e.target.value)}
                aria-label="Especialidad"
              >
                <option value="">Todas las especialidades</option>
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                style={{ flex: '0 1 190px' }}
                value={filters.professional_type_id ?? ''}
                onChange={(e) => setFilter('professional_type_id', e.target.value)}
                aria-label="Tipo profesional"
              >
                <option value="">Todos los tipos</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <select
                style={{ flex: '0 1 210px' }}
                value={filters.origin ?? ''}
                onChange={(e) => setFilter('origin', e.target.value)}
                aria-label="Origen del paciente"
              >
                <option value="">Todos los orígenes</option>
                <option value="publica">Cola pública</option>
                <option value="consultorio">Consultorio (alta por médico)</option>
              </select>
              <select
                style={{ flex: '0 1 190px' }}
                value={filters.affected_zone ?? ''}
                onChange={(e) => setFilter('affected_zone', e.target.value)}
                aria-label="Zona afectada"
              >
                <option value="">Todas las zonas</option>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              <select
                style={{ flex: '0 1 160px' }}
                value={filters.age_range ?? ''}
                onChange={(e) => setFilter('age_range', e.target.value)}
                aria-label="Rango de edad"
              >
                <option value="">Todas las edades</option>
                {AGE_RANGES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <select
                style={{ flex: '0 1 200px' }}
                value={filters.has_consultations ?? ''}
                onChange={(e) => setFilter('has_consultations', e.target.value)}
                aria-label="Tiene consultas"
              >
                <option value="">Con y sin consultas</option>
                <option value="true">Solo con consultas</option>
                <option value="false">Solo sin ninguna consulta</option>
              </select>
              <select
                style={{ flex: '0 1 180px' }}
                value={filters.has_account ?? ''}
                onChange={(e) => setFilter('has_account', e.target.value)}
                aria-label="Tiene cuenta"
              >
                <option value="">Con y sin cuenta</option>
                <option value="true">Solo con cuenta</option>
                <option value="false">Solo sin cuenta</option>
              </select>
              <select
                style={{ flex: '0 1 180px' }}
                value={filters.consent ?? ''}
                onChange={(e) => setFilter('consent', e.target.value)}
                aria-label="Consentimiento"
              >
                <option value="">Consentimiento: cualquiera</option>
                <option value="true">Con consentimiento</option>
                <option value="false">Sin consentimiento</option>
              </select>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flex: '0 1 200px',
                  fontSize: 14,
                  color: '#334155'
                }}
              >
                <input
                  type="checkbox"
                  checked={filters.include_archived === 'true'}
                  onChange={(e) => setFilter('include_archived', e.target.checked ? 'true' : '')}
                />
                Incluir archivados
              </label>
            </>
          )}

          <input
            type="date"
            style={{ flex: '0 1 150px' }}
            value={filters.created_from ?? ''}
            onChange={(e) => setFilter('created_from', e.target.value)}
            title="Registrados desde (inclusive)"
            aria-label="Registrados desde"
          />
          <input
            type="date"
            style={{ flex: '0 1 150px' }}
            value={filters.created_to ?? ''}
            onChange={(e) => setFilter('created_to', e.target.value)}
            title="Registrados hasta (inclusive)"
            aria-label="Registrados hasta"
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
            Vista previa{' '}
            <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 14 }}>
              ({total} {total === 1 ? 'fila' : 'filas'} en el reporte)
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

        {/* El aviso de que la tabla es una muestra y el archivo trae todo: sin esto, ver 25
            filas y descargar 2.800 parece un error del sistema. */}
        <p style={{ marginTop: 0, color: '#64748b', fontSize: 13 }}>
          La tabla muestra {Math.min(PAGE_SIZE, total)} de {total} filas. El Excel incluye{' '}
          <strong>todas</strong> las que cumplen estos filtros, con todas las columnas y una portada
          que deja registrados los filtros aplicados.
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
            Reporte descargado como <strong>{exported}</strong>.
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} style={{ whiteSpace: 'nowrap' }}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!preview || preview.rows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(columns.length, 1)} style={{ color: '#64748b' }}>
                    {previewLoading ? 'Cargando...' : 'Ningún registro coincide con estos filtros.'}
                  </td>
                </tr>
              ) : (
                preview.rows.map((row, i) => (
                  <tr key={String(row.doctor_id || row.patient_id || i)}>
                    {columns.map((c) => (
                      <td key={c.key} style={{ whiteSpace: 'nowrap' }}>
                        {cellText(row[c.key], c.kind)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            flexWrap: 'wrap'
          }}
        >
          <span style={{ color: '#64748b', fontSize: 13 }}>
            {total === 0
              ? 'Sin resultados'
              : `Mostrando ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} de ${total}`}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-muted"
              disabled={page === 0 || previewLoading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </button>
            <button
              type="button"
              className="btn btn-muted"
              disabled={(page + 1) * PAGE_SIZE >= total || previewLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>
    </AdminLayout>
  )
}
