DO $$ 
BEGIN
  ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'email') THEN
    ALTER TABLE user_roles ADD COLUMN email text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'permissions') THEN
    ALTER TABLE user_roles ADD COLUMN permissions jsonb DEFAULT '{
      "can_view_vehicles": true,
      "can_edit_vehicles": false,
      "can_delete_vehicles": false,
      "can_view_drivers": true,
      "can_edit_drivers": false,
      "can_delete_drivers": false,
      "can_view_trips": true,
      "can_edit_trips": false,
      "can_delete_trips": false,
      "can_view_maintenance": true,
      "can_edit_maintenance": false,
      "can_manage_roles": false
    }'::jsonb NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'is_active') THEN
    ALTER TABLE user_roles ADD COLUMN is_active boolean DEFAULT true NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'created_by') THEN
    ALTER TABLE user_roles ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  
  UPDATE user_roles SET role = 'viewer' WHERE role NOT IN ('admin', 'manager', 'driver', 'viewer');
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'user_roles' AND constraint_name = 'user_roles_role_check'
  ) THEN
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('admin', 'manager', 'driver', 'viewer'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  role text DEFAULT 'viewer' NOT NULL CHECK (role IN ('admin', 'manager', 'driver', 'viewer')),
  permissions jsonb DEFAULT '{
    "can_view_vehicles": true,
    "can_edit_vehicles": false,
    "can_delete_vehicles": false,
    "can_view_drivers": true,
    "can_edit_drivers": false,
    "can_delete_drivers": false,
    "can_view_trips": true,
    "can_edit_trips": false,
    "can_delete_trips": false,
    "can_view_maintenance": true,
    "can_edit_maintenance": false,
    "can_manage_roles": false
  }'::jsonb NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_is_active ON user_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_roles_email ON user_roles(email);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
CREATE POLICY "Users can view own role"
  ON user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
CREATE POLICY "Admins can view all roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
      AND user_roles.is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
CREATE POLICY "Admins can insert roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
      AND user_roles.is_active = true
    )
    OR NOT EXISTS (SELECT 1 FROM user_roles LIMIT 1)
  );

DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
CREATE POLICY "Admins can update roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
      AND user_roles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
      AND user_roles.is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;
CREATE POLICY "Admins can delete roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
      AND user_roles.is_active = true
    )
  );

CREATE OR REPLACE FUNCTION update_user_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_roles_updated_at_trigger ON user_roles;
CREATE TRIGGER update_user_roles_updated_at_trigger
  BEFORE UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_roles_updated_at();
