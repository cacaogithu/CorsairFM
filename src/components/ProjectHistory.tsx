import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Calendar, Image, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  status: string;
  created_at: string;
  total_images: number;
  completed_images: number;
  pdf_filename: string;
}

interface ProjectHistoryProps {
  onBack: () => void;
  onSelectProject: (projectId: string) => void;
}

export const ProjectHistory = ({ onBack, onSelectProject }: ProjectHistoryProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageStats, setStorageStats] = useState({ totalImages: 0, totalSizeMB: 0 });

  useEffect(() => {
    fetchProjects();
    fetchStorageStats();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      toast.error("Failed to load project history");
    } finally {
      setLoading(false);
    }
  };

  const fetchStorageStats = async () => {
    try {
      // Get count of all images
      const { count: imageCount } = await supabase
        .from("images")
        .select("*", { count: "exact", head: true });

      // Get storage bucket sizes (approximate)
      const buckets = ["original-images", "edited-images", "project-briefs"];
      let totalSize = 0;

      for (const bucket of buckets) {
        const { data: files } = await supabase.storage.from(bucket).list();
        if (files) {
          // Estimate size based on file count (rough approximation)
          totalSize += files.length * 2; // Assume ~2MB per file on average
        }
      }

      setStorageStats({
        totalImages: imageCount || 0,
        totalSizeMB: totalSize,
      });
    } catch (error) {
      console.error("Failed to fetch storage stats:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "processing_images":
      case "parsing_pdf":
      case "uploading":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      uploading: "Uploading",
      parsing_pdf: "Parsing PDF",
      processing_images: "Processing",
      completed: "Completed",
      failed: "Failed",
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-gradient-hero backdrop-blur-sm sticky top-0 z-10 shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack} className="text-primary-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-xl font-bold text-primary-foreground font-montserrat">
              Project History
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Storage Stats */}
          <Card className="p-6 bg-card/50 backdrop-blur-sm">
            <h2 className="text-lg font-semibold mb-4">Storage Overview</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Image className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{storageStats.totalImages}</p>
                  <p className="text-sm text-muted-foreground">Total Images</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{projects.length}</p>
                  <p className="text-sm text-muted-foreground">Total Projects</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Projects List */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Recent Projects</h2>
            {projects.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No projects yet. Create your first project!</p>
              </Card>
            ) : (
              projects.map((project) => (
                <Card
                  key={project.id}
                  className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => onSelectProject(project.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(project.status)}
                        <h3 className="font-semibold text-lg">{project.name}</h3>
                        <span className="text-sm px-2 py-1 rounded-full bg-muted">
                          {getStatusText(project.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {new Date(project.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-2">
                          <Image className="w-4 h-4" />
                          {project.completed_images} / {project.total_images} images
                        </div>
                      </div>
                      {project.pdf_filename && (
                        <p className="text-xs text-muted-foreground mt-2">
                          PDF: {project.pdf_filename}
                        </p>
                      )}
                    </div>
                    <Button variant="outline">View Project</Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
