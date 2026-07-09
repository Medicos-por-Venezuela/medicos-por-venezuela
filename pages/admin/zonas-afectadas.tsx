import AdminLayout, { AdminLoading } from '../../components/admin/AdminLayout'
import CatalogManager from '../../components/admin/CatalogManager'
import { useAdminGuard } from '../../lib/admin'

const FIELDS = [
  { key: 'name', label: 'Nombre' },
  { key: 'state', label: 'Estado / región' },
  { key: 'country', label: 'País', defaultValue: 'Venezuela' },
  { key: 'status', label: 'Estatus', type: 'select' as const, options: ['active', 'inactive'] }
]

export default function AdminZonasAfectadas() {
  const { profile, loading } = useAdminGuard()
  if (loading) return <AdminLoading />

  return (
    <AdminLayout title="Zonas afectadas" profile={profile}>
      <CatalogManager
        resourceLabel="zona afectada"
        pluralLabel="zonas afectadas"
        listPath="/api/v1/affected-zones/admin"
        basePath="/api/v1/affected-zones"
        fields={FIELDS}
      />
    </AdminLayout>
  )
}
