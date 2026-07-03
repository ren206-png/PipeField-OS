import { Suspense } from 'react'
import { UserManagementTable } from '@/components/admin/UserManagementTable'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

export const metadata = { title: 'User Management — PipeField OS Admin' }

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-50">User Management</h1>
        <p className="text-sm text-surface-500 mt-1">
          All users across every organization on PipeField OS.
        </p>
      </div>

      <Suspense fallback={<LoadingSpinner />}>
        <UserManagementTable />
      </Suspense>
    </div>
  )
}
