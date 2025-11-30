-- Create storage buckets for the image editor
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('project-briefs', 'project-briefs', true, 52428800, ARRAY['application/pdf']),
  ('original-images', 'original-images', true, 52428800, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']),
  ('edited-images', 'edited-images', true, 52428800, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for project-briefs bucket
CREATE POLICY "Allow public access to project briefs"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-briefs');

CREATE POLICY "Allow authenticated uploads to project briefs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-briefs');

-- Set up storage policies for original-images bucket
CREATE POLICY "Allow public access to original images"
ON storage.objects FOR SELECT
USING (bucket_id = 'original-images');

CREATE POLICY "Allow authenticated uploads to original images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'original-images');

-- Set up storage policies for edited-images bucket
CREATE POLICY "Allow public access to edited images"
ON storage.objects FOR SELECT
USING (bucket_id = 'edited-images');

CREATE POLICY "Allow authenticated uploads to edited images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'edited-images');