import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ReviewImage {
  id: string;
  image_number: number;
  original_filename: string;
  edited_url: string | null;
  title: string;
  subtitle: string;
  text_accuracy_score: number | null;
  retry_count: number;
  project_id: string;
}

export const ReviewQueue = () => {
  const [reviewImages, setReviewImages] = useState<ReviewImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReviewImages();
  }, []);

  const loadReviewImages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .eq('needs_review', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading review queue:', error);
      toast.error('Failed to load review queue');
    } else {
      setReviewImages(data || []);
    }
    setLoading(false);
  };

  const handleApprove = async (imageId: string) => {
    const { error } = await supabase
      .from('images')
      .update({ 
        needs_review: false,
        status: 'completed',
        approved_version: 1
      })
      .eq('id', imageId);

    if (error) {
      toast.error('Failed to approve image');
    } else {
      toast.success('Image approved');
      loadReviewImages();
    }
  };

  const handleRegenerate = async (imageId: string) => {
    const { error } = await supabase
      .from('images')
      .update({ 
        status: 'queued',
        needs_review: false,
        retry_count: 0
      })
      .eq('id', imageId);

    if (error) {
      toast.error('Failed to queue regeneration');
    } else {
      toast.info('Image queued for regeneration');
      
      // Trigger processing
      const image = reviewImages.find(img => img.id === imageId);
      if (image) {
        await supabase.functions.invoke('process-images', {
          body: { projectId: image.project_id }
        });
      }
      
      loadReviewImages();
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading review queue...</div>;
  }

  if (reviewImages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No images need review</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Images Needing Review ({reviewImages.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reviewImages.map((img) => (
            <div key={img.id} className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="flex-shrink-0">
                {img.edited_url && (
                  <img 
                    src={img.edited_url} 
                    alt={img.original_filename}
                    className="w-32 h-32 object-cover rounded"
                  />
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium">{img.original_filename}</div>
                <div className="text-sm text-muted-foreground">
                  Title: {img.title}<br />
                  Subtitle: {img.subtitle}
                </div>
                <div className="flex gap-2 mt-2">
                  <Badge variant={
                    (img.text_accuracy_score || 0) >= 90 ? "default" : 
                    (img.text_accuracy_score || 0) >= 70 ? "secondary" : 
                    "destructive"
                  }>
                    {img.text_accuracy_score?.toFixed(1)}% accuracy
                  </Badge>
                  <Badge variant="outline">
                    {img.retry_count} retries
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={() => handleApprove(img.id)}
                  variant="default"
                  size="sm"
                >
                  Approve
                </Button>
                <Button 
                  onClick={() => handleRegenerate(img.id)}
                  variant="outline"
                  size="sm"
                >
                  Regenerate
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
