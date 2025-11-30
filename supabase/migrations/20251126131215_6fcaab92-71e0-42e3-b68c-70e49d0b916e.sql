-- Enable realtime for projects table
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;

-- Enable realtime for images table
ALTER TABLE public.images REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.images;

-- Add index for faster project status queries
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

-- Add index for faster image queries by project
CREATE INDEX IF NOT EXISTS idx_images_project_status ON public.images(project_id, status);