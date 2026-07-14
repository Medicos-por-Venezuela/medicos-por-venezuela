import AdminLayout, { AdminLoading } from '../../components/admin/AdminLayout'
import CatalogManager from '../../components/admin/CatalogManager'
import { useAdminGuard } from '../../lib/admin'

const FIELDS = [
  { key: 'name', label: 'Nombre' },
  { key: 'status', label: 'Estatus', type: 'select' as const, options: ['active', 'inactive'] }
]

export default function AdminTiposProfesionales() {
  const { profile, loading } = useAdminGuard()
  if (loading) return <AdminLoading />

  return (
    <AdminLayout title="Tipos de profesionales" profile={profile}>
      <CatalogManager
        resourceLabel="tipo de profesional"
        pluralLabel="tipos de profesional"
        gender="m"
        listPath="/api/v1/professional-types/admin"
        basePath="/api/v1/professional-types"
        fields={FIELDS}
      />
    </AdminLayout>
  )
}
