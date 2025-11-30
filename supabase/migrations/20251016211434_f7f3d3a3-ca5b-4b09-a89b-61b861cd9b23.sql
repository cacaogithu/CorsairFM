-- Update storage buckets with correct configuration
UPDATE storage.buckets
SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'project-briefs';

UPDATE storage.buckets
SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
WHERE id = 'original-images';

UPDATE storage.buckets
SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
WHERE id = 'edited-images';