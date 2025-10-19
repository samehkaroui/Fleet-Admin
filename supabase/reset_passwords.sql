UPDATE auth.users
SET encrypted_password = crypt('password123', gen_salt('bf'))
WHERE email IN (
  'admin@fleetmanager.com',
  'manager@fleetmanager.com',
  'driver@fleetmanager.com',
  'viewer@fleetmanager.com'
);

SELECT email, id FROM auth.users 
WHERE email IN (
  'admin@fleetmanager.com',
  'manager@fleetmanager.com',
  'driver@fleetmanager.com',
  'viewer@fleetmanager.com'
);
