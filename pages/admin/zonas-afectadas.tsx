import AdminLayout, { AdminLoading } from '../../components/admin/AdminLayout'
import CatalogManager from '../../components/admin/CatalogManager'
import { useAdminGuard } from '../../lib/admin'

// Una zona = un estado de Venezuela, así que `state` se mantiene por compatibilidad con la
// tabla (NOT NULL) pero se edita igual que el nombre. Ver la migración de siembra de estados.
const FIELDS = [
  { key: 'name', label: 'Zona' },
  { key: 'state', label: 'Estado' },
  { key: 'country', label: 'País', defaultValue: 'Venezuela' },
  { key: 'status', label: 'Estatus', type: 'select' as const, options: ['active', 'inactive'] }
]

export default function AdminZonas() {
  const { profile, loading } = useAdminGuard()
  if (loading) return <AdminLoading />

  return (
    <AdminLayout title="Zonas" profile={profile}>
      <CatalogManager
        resourceLabel="zona"
        pluralLabel="zonas"
        listPath="/api/v1/affected-zones/admin"
        basePath="/api/v1/affected-zones"
        fields={FIELDS}
      />
    </AdminLayout>
  )
}
