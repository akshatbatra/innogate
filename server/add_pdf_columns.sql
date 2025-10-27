-- Add new columns to uploaded_pdfs table
ALTER TABLE uploaded_pdfs ADD COLUMN IF NOT EXISTS work_title TEXT;
ALTER TABLE uploaded_pdfs ADD COLUMN IF NOT EXISTS orcid_id TEXT;
ALTER TABLE uploaded_pdfs ADD COLUMN IF NOT EXISTS researcher_name TEXT;
