-- Phase 6: Database Schema Enhancements

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_images_project_status 
  ON images(project_id, status);

CREATE INDEX IF NOT EXISTS idx_images_needs_review 
  ON images(needs_review) WHERE needs_review = true;

-- Add retry history tracking
ALTER TABLE images 
  ADD COLUMN IF NOT EXISTS retry_history jsonb DEFAULT '[]'::jsonb;

-- Track which version user approved
ALTER TABLE images
  ADD COLUMN IF NOT EXISTS approved_version integer DEFAULT 1;