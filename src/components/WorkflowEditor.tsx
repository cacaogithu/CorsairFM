import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Play, Edit2, Save, RefreshCw, X } from "lucide-react";

interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

interface ImageRecord {
  id: string;
  image_number: number;
  original_filename: string;
  title: string;
  subtitle: string;
  ai_prompt: string;
  status: string;
  variant: string;
}

export function WorkflowEditor({ projectId }: { projectId: string }) {
  const [steps, setSteps] = useState<WorkflowStep[]>([
    { id: 'upload', name: 'Upload PDF & Images', status: 'completed' },
    { id: 'parse-pdf', name: 'Parse PDF with AI', status: 'running' },
    { id: 'match-assets', name: 'Match Images to Specs', status: 'pending' },
    { id: 'analyze-images', name: 'Analyze Each Image', status: 'pending' },
    { id: 'process-images', name: 'Generate Edited Images', status: 'pending' },
  ]);

  const [images, setImages] = useState<ImageRecord[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
  const [editingPrompt, setEditingPrompt] = useState('');

  useEffect(() => {
    loadImages();
    
    const subscription = supabase
      .channel('workflow-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'images',
        filter: `project_id=eq.${projectId}`
      }, loadImages)
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [projectId]);

  const loadImages = async () => {
    const { data } = await supabase
      .from('images')
      .select('*')
      .eq('project_id', projectId)
      .order('image_number');
    
    setImages(data || []);
  };

  const handlePromptEdit = (image: ImageRecord) => {
    setSelectedImage(image);
    setEditingPrompt(image.ai_prompt);
  };

  const savePrompt = async () => {
    if (!selectedImage) return;
    
    await supabase
      .from('images')
      .update({ ai_prompt: editingPrompt })
      .eq('id', selectedImage.id);
    
    setSelectedImage(null);
    loadImages();
  };

  const reprocessImage = async (imageId: string) => {
    await supabase
      .from('images')
      .update({ status: 'queued', retry_count: 0 })
      .eq('id', imageId);
    
    await supabase.functions.invoke('process-images', {
      body: { projectId }
    });
  };

  return (
    <div className="space-y-6">
      {/* Workflow Pipeline Visualization */}
      <Card className="p-6 bg-card border-border">
        <h2 className="text-xl font-bold mb-4 text-foreground">Processing Pipeline</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  step.status === 'completed' ? 'bg-secondary' :
                  step.status === 'running' ? 'bg-primary animate-pulse' :
                  step.status === 'failed' ? 'bg-destructive' :
                  'bg-muted'
                }`}>
                  {step.status === 'running' ? <Play className="w-6 h-6 text-primary-foreground" /> : 
                   step.status === 'completed' ? '✓' : idx + 1}
                </div>
                <p className="text-xs mt-2 text-center w-20 text-muted-foreground">{step.name}</p>
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-12 h-1 ${
                  step.status === 'completed' ? 'bg-secondary' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Image Grid with Editable Prompts */}
      <Card className="p-6 bg-card border-border">
        <h2 className="text-xl font-bold mb-4 text-foreground">Image Prompts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {images.map((img) => (
            <div key={img.id} className="border border-border rounded-lg p-4 bg-muted/30">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{img.title}</p>
                  <p className="text-sm text-muted-foreground">{img.original_filename}</p>
                  <Badge variant={
                    img.status === 'completed' ? 'default' :
                    img.status === 'processing' ? 'secondary' :
                    img.status === 'failed' ? 'destructive' : 'outline'
                  } className="mt-1">
                    {img.status}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handlePromptEdit(img)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  {img.status === 'completed' && (
                    <Button size="sm" variant="outline" onClick={() => reprocessImage(img.id)}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{img.ai_prompt}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Prompt Editor Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">Edit AI Prompt</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedImage(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {selectedImage.title} - {selectedImage.original_filename}
            </p>
            <Textarea
              value={editingPrompt}
              onChange={(e) => setEditingPrompt(e.target.value)}
              rows={8}
              className="mb-4 bg-background"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedImage(null)}>
                Cancel
              </Button>
              <Button onClick={savePrompt}>
                <Save className="w-4 h-4 mr-2" />
                Save & Reprocess
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
