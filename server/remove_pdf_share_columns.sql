-- Remove status tracking columns from pdf_share_requests table
ALTER TABLE pdf_share_requests DROP COLUMN IF EXISTS status;
ALTER TABLE pdf_share_requests DROP COLUMN IF EXISTS responded_at;
