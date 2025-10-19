-- ========================================
-- FIX COMPLETE - Run this in Supabase SQL Editor
-- ========================================

-- Step 1: Drop old policies
DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;

-- Step 2: Create simple policies (allow all authenticated users)
CREATE POLICY "Allow authenticated users to view all roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (true);

-- Step 3: Insert admin role for current user
INSERT INTO user_roles (user_id, email, role, permissions, is_active, created_by)
SELECT 
  id,
  email,
  'admin',
  '{"can_view_vehicles": true, "can_edit_vehicles": true, "can_delete_vehicles": true, "can_view_drivers": true, "can_edit_drivers": true, "can_delete_drivers": true, "can_view_trips": true, "can_edit_trips": true, "can_delete_trips": true, "can_view_maintenance": true, "can_edit_maintenance": true, "can_manage_roles": true}'::jsonb,
  true,
  id
FROM auth.users
WHERE email = 'admin@fleetmanager.com'
ON CONFLICT (user_id) DO UPDATE
SET role = 'admin', is_active = true, updated_at = now();

-- Step 4: Insert other sample users
INSERT INTO user_roles (user_id, email, role, permissions, is_active, created_by)
VALUES (
  '00655934-4321-4d56-b25c-0b376582a319',
  'manager@fleetmanager.com',
  'manager',
  '{"can_view_vehicles": true, "can_edit_vehicles": true, "can_delete_vehicles": false, "can_view_drivers": true, "can_edit_drivers": true, "can_delete_drivers": false, "can_view_trips": true, "can_edit_trips": true, "can_delete_trips": false, "can_view_maintenance": true, "can_edit_maintenance": true, "can_manage_roles": false}'::jsonb,
  true,
  'e1ad1e41-3018-4540-8372-9f6f0495a4f2'
)
ON CONFLICT (user_id) DO UPDATE SET role = 'manager', is_active = true, updated_at = now();

INSERT INTO user_roles (user_id, email, role, permissions, is_active, created_by)
VALUES (
  'baff1971-4ecb-4f11-9c53-bf4486c02626',
  'driver@fleetmanager.com',
  'driver',
  '{"can_view_vehicles": true, "can_edit_vehicles": false, "can_delete_vehicles": false, "can_view_drivers": false, "can_edit_drivers": false, "can_delete_drivers": false, "can_view_trips": true, "can_edit_trips": false, "can_delete_trips": false, "can_view_maintenance": true, "can_edit_maintenance": false, "can_manage_roles": false}'::jsonb,
  true,
  'e1ad1e41-3018-4540-8372-9f6f0495a4f2'
)
ON CONFLICT (user_id) DO UPDATE SET role = 'driver', is_active = true, updated_at = now();

INSERT INTO user_roles (user_id, email, role, permissions, is_active, created_by)
VALUES (
  'db5de58c-0df6-45d0-98c4-26a0ba2bfe7c',
  'viewer@fleetmanager.com',
  'viewer',
  '{"can_view_vehicles": true, "can_edit_vehicles": false, "can_delete_vehicles": false, "can_view_drivers": true, "can_edit_drivers": false, "can_delete_drivers": false, "can_view_trips": true, "can_edit_trips": false, "can_delete_trips": false, "can_view_maintenance": true, "can_edit_maintenance": false, "can_manage_roles": false}'::jsonb,
  true,
  'e1ad1e41-3018-4540-8372-9f6f0495a4f2'
)
ON CONFLICT (user_id) DO UPDATE SET role = 'viewer', is_active = true, updated_at = now();

-- Step 5: Reset passwords for all users
UPDATE auth.users
SET encrypted_password = crypt('password123', gen_salt('bf'))
WHERE email IN (
  'admin@fleetmanager.com',
  'manager@fleetmanager.com',
  'driver@fleetmanager.com',
  'viewer@fleetmanager.com'
);

-- Step 6: Verify
SELECT 
  ur.email,
  ur.role,
  ur.is_active,
  ur.created_at
FROM user_roles ur
ORDER BY ur.created_at DESC;
