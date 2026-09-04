// Los controles de filtro de /admin/reportes, uno por reporte.
//
// Viven aquí y no en la página porque son la parte que crece con cada reporte nuevo: dejarlos
// dentro convertía `reportes.tsx` en un fichero donde el 60% era JSX de <select>. La página se
// queda con el estado, la carga y la tabla; esto solo pinta controles y avisa de los cambios.
import { filterText, ReportFilters, ReportKind } from '../../lib/reports'
import { ProfessionalTypeResponse, SpecialtyResponse } from '../../lib/doctors'
import { STATUS_OPTIONS } from '../../lib/admin'
import { STATUS_LABELS } from '../../lib/utils'

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

export type FilterSetter = (key: keyof ReportFilters, value: string) => void

type Props = {
  kind: ReportKind
  filters: ReportFilters
  setFilter: FilterSetter
  specialties: SpecialtyResponse[]
  types: ProfessionalTypeResponse[]
  zones: string[]
}

export default function ReportFilterControls({
  kind,
  filters,
  setFilter,
  specialties,
  types,
  zones
}: Props) {
  if (kind === 'doctors') {
    return (
      <DoctorControls
        filters={filters}
        setFilter={setFilter}
        specialties={specialties}
        types={types}
      />
    )
  }
  if (kind === 'patients') {
    return <PatientControls filters={filters} setFilter={setFilter} zones={zones} />
  }
  return <ConsultationControls filters={filters} setFilter={setFilter} specialties={specialties} />
}

function DoctorControls({
  filters,
  setFilter,
  specialties,
  types
}: {
  filters: ReportFilters
  setFilter: FilterSetter
  specialties: SpecialtyResponse[]
  types: ProfessionalTypeResponse[]
}) {
  return (
    <>
      <select
        style={{ flex: '0 1 170px' }}
        value={filterText(filters.status)}
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
  )
}

function PatientControls({
  filters,
  setFilter,
  zones
}: {
  filters: ReportFilters
  setFilter: FilterSetter
  zones: string[]
}) {
  return (
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
  )
}

// Consultas. El estado NO es un <select> de un valor: el informe por defecto es el set del
// monitor del dashboard (seis estados a la vez), así que el control ofrece presets y manda la
// lista. `IN_PROGRESS_STATUSES` sale de lib/admin.ts, el mismo array que usa el modal — si se
// definiera aquí otra vez, el Excel y la pantalla podrían acabar mostrando poblaciones
// distintas sin que nadie lo note.
function ConsultationControls({
  filters,
  setFilter,
  specialties
}: {
  filters: ReportFilters
  setFilter: FilterSetter
  specialties: SpecialtyResponse[]
}) {
  const preset = Array.isArray(filters.status) ? 'en_progreso' : (filters.status ?? '')
  return (
    <>
      <select
        style={{ flex: '0 1 260px' }}
        value={preset}
        onChange={(e) => setFilter('status', e.target.value)}
        aria-label="Estados incluidos"
      >
        <option value="en_progreso">En progreso (las del monitor)</option>
        <option value="">Todos los estados</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            Solo: {STATUS_LABELS[s] || s}
          </option>
        ))}
      </select>
      <select
        style={{ flex: '0 1 200px' }}
        value={filters.specialty_id ?? ''}
        onChange={(e) => setFilter('specialty_id', e.target.value)}
        aria-label="Especialidad solicitada"
      >
        <option value="">Todas las especialidades</option>
        {specialties.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select
        style={{ flex: '0 1 200px' }}
        value={filterText(filters.unassigned)}
        onChange={(e) => setFilter('unassigned', e.target.value)}
        aria-label="Asignación"
      >
        <option value="">Asignadas y sin asignar</option>
        <option value="false">Solo asignadas</option>
        <option value="true">Solo sin médico asignado</option>
      </select>
    </>
  )
}
