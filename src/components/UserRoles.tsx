import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Shield, UserPlus, Edit2, Trash2, Check, X, AlertCircle, Search } from 'lucide-react';

type Role = 'admin' | 'manager' | 'driver' | 'viewer';

interface Permissions {
  can_view_vehicles: boolean;
  can_edit_vehicles: boolean;
  can_delete_vehicles: boolean;
  can_view_drivers: boolean;
  can_edit_drivers: boolean;
  can_delete_drivers: boolean;
  can_view_trips: boolean;
  can_edit_trips: boolean;
  can_delete_trips: boolean;
  can_view_maintenance: boolean;
  can_edit_maintenance: boolean;
  can_manage_roles: boolean;
}

interface UserRole {
  id: string;
  user_id: string;
  email: string;
  role: Role;
  permissions: Permissions;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const defaultPermissions: Record<Role, Permissions> = {
  admin: {
    can_view_vehicles: true,
    can_edit_vehicles: true,
    can_delete_vehicles: true,
    can_view_drivers: true,
    can_edit_drivers: true,
    can_delete_drivers: true,
    can_view_trips: true,
    can_edit_trips: true,
    can_delete_trips: true,
    can_view_maintenance: true,
    can_edit_maintenance: true,
    can_manage_roles: true,
  },
  manager: {
    can_view_vehicles: true,
    can_edit_vehicles: true,
    can_delete_vehicles: false,
    can_view_drivers: true,
    can_edit_drivers: true,
    can_delete_drivers: false,
    can_view_trips: true,
    can_edit_trips: true,
    can_delete_trips: false,
    can_view_maintenance: true,
    can_edit_maintenance: true,
    can_manage_roles: false,
  },
  driver: {
    can_view_vehicles: true,
    can_edit_vehicles: false,
    can_delete_vehicles: false,
    can_view_drivers: false,
    can_edit_drivers: false,
    can_delete_drivers: false,
    can_view_trips: true,
    can_edit_trips: false,
    can_delete_trips: false,
    can_view_maintenance: true,
    can_edit_maintenance: false,
    can_manage_roles: false,
  },
  viewer: {
    can_view_vehicles: true,
    can_edit_vehicles: false,
    can_delete_vehicles: false,
    can_view_drivers: true,
    can_edit_drivers: false,
    can_delete_drivers: false,
    can_view_trips: true,
    can_edit_trips: false,
    can_delete_trips: false,
    can_view_maintenance: true,
    can_edit_maintenance: false,
    can_manage_roles: false,
  },
};

export default function UserRoles() {
  const { user } = useAuth();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUserRole, setSelectedUserRole] = useState<UserRole | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);

  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<Role>('viewer');
  const [formPermissions, setFormPermissions] = useState<Permissions>(defaultPermissions.viewer);
  const [formIsActive, setFormIsActive] = useState(true);

  useEffect(() => {
    fetchUserRoles();
    fetchCurrentUserRole();
  }, []);

  const fetchCurrentUserRole = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setCurrentUserRole(data);
    } catch (err) {
      console.error('Error fetching current user role:', err);
    }
  };

  const fetchUserRoles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserRoles(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user roles');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    try {
      setError(null);
      
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        setError('Unable to verify user. Please ensure the email is registered.');
        return;
      }

      const existingUser = authUsers.users.find(u => u.email === formEmail);
      
      if (!existingUser) {
        setError('User with this email does not exist. Please ensure they are registered first.');
        return;
      }

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: existingUser.id,
          email: formEmail,
          role: formRole,
          permissions: formPermissions,
          is_active: formIsActive,
          created_by: user?.id,
        });

      if (error) throw error;

      await fetchUserRoles();
      setIsAddModalOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user role');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUserRole) return;

    try {
      setError(null);
      const { error } = await supabase
        .from('user_roles')
        .update({
          role: formRole,
          permissions: formPermissions,
          is_active: formIsActive,
        })
        .eq('id', selectedUserRole.id);

      if (error) throw error;

      await fetchUserRoles();
      setIsEditModalOpen(false);
      setSelectedUserRole(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user role');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user role?')) return;

    try {
      setError(null);
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchUserRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user role');
    }
  };

  const openEditModal = (userRole: UserRole) => {
    setSelectedUserRole(userRole);
    setFormEmail(userRole.email);
    setFormRole(userRole.role);
    setFormPermissions(userRole.permissions);
    setFormIsActive(userRole.is_active);
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormEmail('');
    setFormRole('viewer');
    setFormPermissions(defaultPermissions.viewer);
    setFormIsActive(true);
  };

  const handleRoleChange = (role: Role) => {
    setFormRole(role);
    setFormPermissions(defaultPermissions[role]);
  };

  const togglePermission = (key: keyof Permissions) => {
    setFormPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const filteredUserRoles = userRoles.filter(ur =>
    (ur.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (ur.role?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeColor = (role: Role) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'manager':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'driver':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'viewer':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const isAdmin = currentUserRole?.role === 'admin' && currentUserRole?.is_active;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="bg-emerald-500/10 p-3 rounded-xl">
              <Shield className="w-8 h-8 text-emerald-400" />
            </div>
            User Roles Management
          </h1>
          <p className="text-slate-400 mt-2">Manage user roles and permissions</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition font-medium"
          >
            <UserPlus className="w-5 h-5" />
            Add User Role
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">Error</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by email or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />
      </div>

      <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Role</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Created At</th>
                {isAdmin && (
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredUserRoles.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-6 py-12 text-center text-slate-400">
                    No user roles found
                  </td>
                </tr>
              ) : (
                filteredUserRoles.map((userRole) => (
                  <tr key={userRole.id} className="hover:bg-slate-700/30 transition">
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{userRole.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium border ${getRoleBadgeColor(userRole.role)}`}>
                        {userRole.role.charAt(0).toUpperCase() + userRole.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {userRole.is_active ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                          <Check className="w-4 h-4" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                          <X className="w-4 h-4" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(userRole.created_at).toLocaleDateString()}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(userRole)}
                            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(userRole.id)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700/50">
              <h2 className="text-2xl font-bold text-white">Add User Role</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
                <select
                  value={formRole}
                  onChange={(e) => handleRoleChange(e.target.value as Role)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="viewer">Viewer</option>
                  <option value="driver">Driver</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-700/50 bg-slate-900/50 text-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <span className="text-white">Active</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Permissions</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(formPermissions).map(([key, value]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900/70 transition">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={() => togglePermission(key as keyof Permissions)}
                        className="w-4 h-4 rounded border-slate-700/50 bg-slate-900/50 text-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
                      />
                      <span className="text-sm text-slate-300">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-700/50 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetForm();
                }}
                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition"
              >
                Add User
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && selectedUserRole && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700/50">
              <h2 className="text-2xl font-bold text-white">Edit User Role</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  disabled
                  className="w-full px-4 py-3 bg-slate-900/30 border border-slate-700/50 rounded-xl text-slate-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
                <select
                  value={formRole}
                  onChange={(e) => handleRoleChange(e.target.value as Role)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="viewer">Viewer</option>
                  <option value="driver">Driver</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-700/50 bg-slate-900/50 text-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <span className="text-white">Active</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Permissions</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(formPermissions).map(([key, value]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900/70 transition">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={() => togglePermission(key as keyof Permissions)}
                        className="w-4 h-4 rounded border-slate-700/50 bg-slate-900/50 text-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
                      />
                      <span className="text-sm text-slate-300">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-700/50 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedUserRole(null);
                  resetForm();
                }}
                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateUser}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition"
              >
                Update User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
