ALTER TABLE document_recipients
  ADD COLUMN IF NOT EXISTS draft_page INTEGER;
