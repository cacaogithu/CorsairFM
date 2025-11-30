-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'parsing_pdf', 'processing_images', 'completed', 'failed')),
  pdf_url TEXT,
  pdf_filename TEXT,
  total_images INTEGER DEFAULT 0,
  completed_images INTEGER DEFAULT 0,
  brand_preset JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create images table
CREATE TABLE IF NOT EXISTS public.images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  image_number INTEGER NOT NULL,
  original_url TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  edited_url TEXT,
  title TEXT,
  subtitle TEXT,
  asset_name TEXT,
  variant TEXT,
  ai_prompt TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  processing_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('project-briefs', 'project-briefs', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('original-images', 'original-images', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('edited-images', 'edited-images', true) ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

-- Projects policies (public access for now since no auth yet)
CREATE POLICY "Allow all access to projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);

-- Images policies
CREATE POLICY "Allow all access to images" ON public.images FOR ALL USING (true) WITH CHECK (true);

-- Storage policies
CREATE POLICY "Allow all uploads to project-briefs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'project-briefs');
CREATE POLICY "Allow all reads from project-briefs" ON storage.objects FOR SELECT USING (bucket_id = 'project-briefs');

CREATE POLICY "Allow all uploads to original-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'original-images');
CREATE POLICY "Allow all reads from original-images" ON storage.objects FOR SELECT USING (bucket_id = 'original-images');

CREATE POLICY "Allow all uploads to edited-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'edited-images');
CREATE POLICY "Allow public reads from edited-images" ON storage.objects FOR SELECT USING (bucket_id = 'edited-images');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_images_updated_at BEFORE UPDATE ON public.images
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_images_project_id ON public.images(project_id);
CREATE INDEX idx_images_status ON public.images(status);
CREATE INDEX idx_projects_status ON public.projects(status);