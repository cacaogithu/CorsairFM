import { useEffect, useState } from "react";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { ResultsGallery } from "./ResultsGallery";
import { WorkflowEditor } from "./WorkflowEditor";
import { supabase } from "@/integrations/supabase/client";

interface ProcessingViewProps {
  projectId: string;
}

interface ProcessingStep {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "failed";
}

interface ImageStatus {
  id: string;
  image_number: number;
  original_filename: string;
  status: string;
  processing_time_ms: number | null;
  text_accuracy_score: number | null;
}

export const ProcessingView = ({ projectId }: ProcessingViewProps) => {
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: "upload", label: "Uploading files", status: "completed" },
    { id: "parse", label: "Parsing PDF with AI", status: "active" },
    { id: "match", label: "Matching images to specifications", status: "pending" },
    { id: "edit", label: "Editing images with AI", status: "pending" },
    { id: "complete", label: "Finalizing results", status: "pending" },
  ]);

  const [images, setImages] = useState<ImageStatus[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("Parsing PDF...");
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const checkProgress = async () => {
      const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      const { data: projectImages } = await supabase
        .from("images")
        .select("id, image_number, original_filename, status, processing_time_ms, text_accuracy_score")
        .eq("project_id", projectId)
        .order("image_number");

      if (project) {
        // Update steps based on project status
        const newSteps = [...steps];
        
        if (project.status === "parsing_pdf") {
          newSteps[1].status = "active";
          setCurrentStep("Extracting image specifications from PDF...");
        } else if (project.status === "processing_images") {
          newSteps[1].status = "completed";
          newSteps[2].status = "completed";
          newSteps[3].status = "active";
          const completed = project.completed_images || 0;
          const total = project.total_images || 1;
          setCurrentStep(`Processing images (${completed} of ${total} complete)...`);
          setOverallProgress((completed / total) * 100);
        } else if (project.status === "completed") {
          newSteps.forEach(step => step.status = "completed");
          setCurrentStep("Processing complete!");
          setOverallProgress(100);
          // Show results after a brief delay
          setTimeout(() => setShowResults(true), 1500);
        } else if (project.status === "failed") {
          const activeStep = newSteps.find(s => s.status === "active");
          if (activeStep) activeStep.status = "failed";
          setCurrentStep("Processing failed");
        }

        setSteps(newSteps);
      }

      if (projectImages) {
        setImages(projectImages);
      }
    };

    // Initial check
    checkProgress();

    // Poll every 2 seconds
    const interval = setInterval(checkProgress, 2000);

    // Set up realtime subscription
    const channel = supabase
      .channel(`project-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`
        },
        () => checkProgress()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'images',
          filter: `project_id=eq.${projectId}`
        },
        () => checkProgress()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-secondary" />;
      case "active":
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  // Show results gallery when complete
  if (showResults) {
    return <ResultsGallery projectId={projectId} />;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle py-12">
      <div className="container max-w-4xl mx-auto px-6">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold text-foreground font-montserrat">
              Processing Your Images
            </h2>
            <p className="text-muted-foreground">
              {currentStep}
            </p>
          </div>

          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-semibold text-foreground">{Math.round(overallProgress)}%</span>
            </div>
            <Progress value={overallProgress} className="h-3" />
          </div>

          {/* Processing Steps */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {getStatusIcon(step.status)}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${
                    step.status === "completed" ? "text-muted-foreground" :
                    step.status === "active" ? "text-foreground" :
                    step.status === "failed" ? "text-destructive" :
                    "text-muted-foreground"
                  }`}>
                    Step {index + 1}: {step.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Individual Images Progress */}
          {images.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-4">Image Processing Status</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {images.map((img) => (
                  <div key={img.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(img.status)}
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Image {img.image_number}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {img.original_filename}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {img.processing_time_ms 
                        ? `${(img.processing_time_ms / 1000).toFixed(1)}s`
                        : '—'}
                      {img.text_accuracy_score && (
                        <Badge variant={
                          img.text_accuracy_score >= 90 ? "default" : 
                          img.text_accuracy_score >= 70 ? "secondary" : 
                          "destructive"
                        } className="ml-2">
                          {img.text_accuracy_score.toFixed(1)}% match
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workflow Editor for Testing */}
          <WorkflowEditor projectId={projectId} />
        </div>
      </div>
    </div>
  );
};
