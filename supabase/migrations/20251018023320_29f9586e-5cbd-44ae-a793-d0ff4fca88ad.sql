-- Add columns for OCR validation to images table
ALTER TABLE images
ADD COLUMN IF NOT EXISTS ocr_extracted_text TEXT,
ADD COLUMN IF NOT EXISTS text_accuracy_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Create index for filtering images that need review
CREATE INDEX IF NOT EXISTS idx_images_needs_review ON images(needs_review) WHERE needs_review = true;