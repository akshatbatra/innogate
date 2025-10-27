-- Seed SQL for Innogate Research Discovery Platform
-- PostgreSQL Database with Drizzle ORM

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  auth0_sub TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create linked_researchers table
CREATE TABLE IF NOT EXISTS linked_researchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  orcid_id TEXT NOT NULL,
  researcher_name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, orcid_id)
);

-- Create uploaded_pdfs table
CREATE TABLE IF NOT EXISTS uploaded_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(owner_id, work_id)
);

-- Create pdf_share_requests table
CREATE TABLE IF NOT EXISTS pdf_share_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_id UUID NOT NULL REFERENCES uploaded_pdfs(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMP,
  UNIQUE(pdf_id, to_user_id)
);

-- Create pdf_access table
CREATE TABLE IF NOT EXISTS pdf_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_id UUID NOT NULL REFERENCES uploaded_pdfs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(pdf_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth0_sub ON users(auth0_sub);
CREATE INDEX IF NOT EXISTS idx_linked_researchers_user_id ON linked_researchers(user_id);
CREATE INDEX IF NOT EXISTS idx_linked_researchers_orcid_id ON linked_researchers(orcid_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_pdfs_user_id ON uploaded_pdfs(owner_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_pdfs_work_id ON uploaded_pdfs(work_id);
CREATE INDEX IF NOT EXISTS idx_pdf_share_requests_to_user ON pdf_share_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_share_requests_from_user ON pdf_share_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_share_requests_status ON pdf_share_requests(status);
CREATE INDEX IF NOT EXISTS idx_pdf_access_user_id ON pdf_access(user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_access_pdf_id ON pdf_access(pdf_id);

-- Insert sample users (for development/testing)
INSERT INTO users (email, auth0_sub, created_at, updated_at)
VALUES 
  ('user1@example.com', 'auth0|user1', NOW(), NOW()),
  ('user2@example.com', 'auth0|user2', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Insert sample linked researchers (for development/testing)
-- Note: These are example ORCID IDs
INSERT INTO linked_researchers (user_id, orcid_id, researcher_name, created_at)
SELECT 
  u.id,
  '0000-0001-6187-6610',
  'Sample Researcher',
  NOW()
FROM users u
WHERE u.email = 'user1@example.com'
ON CONFLICT (user_id, orcid_id) DO NOTHING;

-- Comments explaining the schema
COMMENT ON TABLE users IS 'Stores Auth0 authenticated users with their email and Auth0 subject identifier';
COMMENT ON TABLE linked_researchers IS 'Stores ORCID associations for each user - links users to researchers they want to track';
COMMENT ON TABLE uploaded_pdfs IS 'Stores PDF files for research works - owner can share with other users';
COMMENT ON TABLE pdf_share_requests IS 'Stores sharing requests - pending, accepted, or rejected';
COMMENT ON TABLE pdf_access IS 'Stores who has access to which PDFs after accepting share requests';
COMMENT ON COLUMN users.auth0_sub IS 'Auth0 subject identifier from JWT token';
COMMENT ON COLUMN linked_researchers.orcid_id IS 'ORCID identifier in format 0000-0001-6187-6610';
COMMENT ON COLUMN linked_researchers.researcher_name IS 'Cached researcher name from OpenAlex API';
COMMENT ON COLUMN uploaded_pdfs.owner_id IS 'User who originally uploaded the PDF';
COMMENT ON COLUMN uploaded_pdfs.work_id IS 'OpenAlex work ID (e.g., W2741809807)';
COMMENT ON COLUMN uploaded_pdfs.file_name IS 'Random unique filename stored on server';
COMMENT ON COLUMN uploaded_pdfs.original_name IS 'Original filename uploaded by user';
COMMENT ON COLUMN pdf_share_requests.status IS 'pending, accepted, or rejected';
