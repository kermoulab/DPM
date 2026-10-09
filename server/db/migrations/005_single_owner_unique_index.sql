-- 005_single_owner_unique_index.sql
-- Enforces single-owner invariant at database schema level to eliminate race conditions
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_owner ON users (role) WHERE role = 'owner';
