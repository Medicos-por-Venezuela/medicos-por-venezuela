import AdminLayout, { AdminLoading } from '../../components/admin/AdminLayout'
import UsersManager from '../../components/admin/UsersManager'
import { useAdminGuard } from '../../lib/admin'

export default function AdminUsuarios() {
  const { profile, loading } = useAdminGuard()
  if (loading) return <AdminLoading />

  return (
    <AdminLayout title="Usuarios" profile={profile}>
      <UsersManager />
    </AdminLayout>
  )
}
