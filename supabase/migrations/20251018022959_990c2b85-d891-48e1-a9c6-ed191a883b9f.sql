-- Create table for image feedback
CREATE TABLE image_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID REFERENCES images(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  text_accuracy TEXT CHECK (text_accuracy IN ('perfect', 'minor_issues', 'major_issues')),
  issues JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  expected_title TEXT,
  expected_subtitle TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE image_feedback ENABLE ROW LEVEL SECURITY;

-- Allow all access (matching the pattern of other tables)
CREATE POLICY "Allow all access to image_feedback"
ON image_feedback
FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes for analytics
CREATE INDEX idx_image_feedback_rating ON image_feedback(rating);
CREATE INDEX idx_image_feedback_text_accuracy ON image_feedback(text_accuracy);
CREATE INDEX idx_image_feedback_image_id ON image_feedback(image_id);
CREATE INDEX idx_image_feedback_project_id ON image_feedback(project_id);