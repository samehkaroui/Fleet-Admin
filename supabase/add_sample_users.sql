INSERT INTO user_roles (user_id, email, role, permissions, is_active, created_by)
VALUES (
  'e1ad1e41-3018-4540-8372-9f6f0495a4f2',
  'admin@fleetmanager.com',
  'admin',
  '{"can_view_vehicles": true, "can_edit_vehicles": true, "can_delete_vehicles": true, "can_view_drivers": true, "can_edit_drivers": true, "can_delete_drivers": true, "can_view_trips": true, "can_edit_trips": true, "can_delete_trips": true, "can_view_maintenance": true, "can_edit_maintenance": true, "can_manage_roles": true}'::jsonb,
  true,
  'e1ad1e41-3018-4540-8372-9f6f0495a4f2'
)
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', is_active = true;

INSERT INTO user_roles (user_id, email, role, permissions, is_active, created_by)
VALUES (
  '00655934-4321-4d56-b25c-0b376582a319',
  'manager@fleetmanager.com',
  'manager',
  '{"can_view_vehicles": true, "can_edit_vehicles": true, "can_delete_vehicles": false, "can_view_drivers": true, "can_edit_drivers": true, "can_delete_drivers": false, "can_view_trips": true, "can_edit_trips": true, "can_delete_trips": false, "can_view_maintenance": true, "can_edit_maintenance": true, "can_manage_roles": false}'::jsonb,
  true,
  'e1ad1e41-3018-4540-8372-9f6f0495a4f2'
)
ON CONFLICT (user_id) DO UPDATE SET role = 'manager', is_active = true;

INSERT INTO user_roles (user_id, email, role, permissions, is_active, created_by)
VALUES (
  'baff1971-4ecb-4f11-9c53-bf4486c02626',
  'driver@fleetmanager.com',
  'driver',
  '{"can_view_vehicles": true, "can_edit_vehicles": false, "can_delete_vehicles": false, "can_view_drivers": false, "can_edit_drivers": false, "can_delete_drivers": false, "can_view_trips": true, "can_edit_trips": false, "can_delete_trips": false, "can_view_maintenance": true, "can_edit_maintenance": false, "can_manage_roles": false}'::jsonb,
  true,
  'e1ad1e41-3018-4540-8372-9f6f0495a4f2'
)
ON CONFLICT (user_id) DO UPDATE SET role = 'driver', is_active = true;

INSERT INTO user_roles (user_id, email, role, permissions, is_active, created_by)
VALUES (
  'db5de58c-0df6-45d0-98c4-26a0ba2bfe7c',
  'viewer@fleetmanager.com',
  'viewer',
  '{"can_view_vehicles": true, "can_edit_vehicles": false, "can_delete_vehicles": false, "can_view_drivers": true, "can_edit_drivers": false, "can_delete_drivers": false, "can_view_trips": true, "can_edit_trips": false, "can_delete_trips": false, "can_view_maintenance": true, "can_edit_maintenance": false, "can_manage_roles": false}'::jsonb,
  true,
  'e1ad1e41-3018-4540-8372-9f6f0495a4f2'
)
ON CONFLICT (user_id) DO UPDATE SET role = 'viewer', is_active = true;

SELECT * FROM user_roles ORDER BY created_at DESC;
