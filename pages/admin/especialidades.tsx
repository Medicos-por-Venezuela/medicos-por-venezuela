import AdminLayout, { AdminLoading } from '../../components/admin/AdminLayout'
import CatalogManager from '../../components/admin/CatalogManager'
import { useAdminGuard } from '../../lib/admin'

const FIELDS = [
  { key: 'name', label: 'Nombre' },
  { key: 'status', label: 'Estatus', type: 'select' as const, options: ['active', 'inactive'] }
]

export default function AdminEspecialidades() {
  const { profile, loading } = useAdminGuard()
  if (loading) return <AdminLoading />

  return (
    <AdminLayout title="Especialidades" profile={profile}>
      <CatalogManager
        resourceLabel="especialidad"
        pluralLabel="especialidades"
        listPath="/api/v1/specialties/admin"
        basePath="/api/v1/specialties"
        fields={FIELDS}
      />
    </AdminLayout>
  )
}
