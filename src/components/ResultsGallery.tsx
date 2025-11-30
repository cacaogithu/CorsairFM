import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, RefreshCw, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, XCircle, Maximize2 } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";

interface ImageResult {
  id: string;
  image_number: number;
  original_url: string;
  edited_url: string | null;
  title: string | null;
  subtitle: string | null;
  asset_name: string | null;
  processing_time_ms: number | null;
  status: string;
  error_message: string | null;
  ocr_extracted_text: string | null;
  text_accuracy_score: number | null;
  needs_review: boolean;
  retry_count: number;
}

interface ResultsGalleryProps {
  projectId: string;
}

export const ResultsGallery = ({ projectId }: ResultsGalleryProps) => {
  const [images, setImages] = useState<ImageResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);
  const [feedbackData, setFeedbackData] = useState<Record<string, {
    rating: number | null;
    textAccuracy: 'perfect' | 'minor_issues' | 'major_issues' | null;
    issues: string[];
    notes: string;
  }>>({});

  useEffect(() => {
    fetchImages();
  }, [projectId]);

  const fetchImages = async () => {
    const { data, error } = await supabase
      .from("images")
      .select("*")
      .eq("project_id", projectId)
      .in("status", ["completed", "failed"])
      .order("image_number");

    if (error) {
      console.error("Error fetching images:", error);
      toast.error("Failed to load images");
    } else if (data) {
      setImages(data);
    }
    setLoading(false);
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success(`Downloaded ${filename}`);
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to download image");
    }
  };

  const handleDownloadAll = async () => {
    toast.info("Downloading all images...");
    for (const img of images) {
      await handleDownload(img.edited_url, `${img.asset_name}_edited.jpg`);
    }
  };

  const handleQuickFeedback = async (imageId: string, rating: number, textAccuracy: 'perfect' | 'major_issues') => {
    const image = images.find(img => img.id === imageId);
    if (!image) return;

    try {
      const { error } = await supabase
        .from('image_feedback')
        .insert({
          image_id: imageId,
          project_id: projectId,
          rating,
          text_accuracy: textAccuracy,
          issues: [],
          expected_title: image.title,
          expected_subtitle: image.subtitle,
        });

      if (error) throw error;
      toast.success(rating === 5 ? "Thanks for the positive feedback!" : "Thanks for the feedback! We'll work on improvements.");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback");
    }
  };

  const handleDetailedFeedback = async (imageId: string) => {
    const feedback = feedbackData[imageId];
    const image = images.find(img => img.id === imageId);
    if (!feedback || !image) return;

    if (!feedback.rating) {
      toast.error("Please provide a rating");
      return;
    }

    try {
      const { error } = await supabase
        .from('image_feedback')
        .insert({
          image_id: imageId,
          project_id: projectId,
          rating: feedback.rating,
          text_accuracy: feedback.textAccuracy || 'perfect',
          issues: feedback.issues,
          notes: feedback.notes,
          expected_title: image.title,
          expected_subtitle: image.subtitle,
        });

      if (error) throw error;
      toast.success("Detailed feedback submitted. Thank you!");
      setExpandedFeedback(null);
      setFeedbackData(prev => ({ ...prev, [imageId]: { rating: null, textAccuracy: null, issues: [], notes: '' } }));
    } catch (error) {
      console.error("Error submitting detailed feedback:", error);
      toast.error("Failed to submit feedback");
    }
  };

  const toggleIssue = (imageId: string, issue: string) => {
    setFeedbackData(prev => ({
      ...prev,
      [imageId]: {
        ...prev[imageId] || { rating: null, textAccuracy: null, issues: [], notes: '' },
        issues: prev[imageId]?.issues.includes(issue)
          ? prev[imageId].issues.filter(i => i !== issue)
          : [...(prev[imageId]?.issues || []), issue]
      }
    }));
  };

  const setRating = (imageId: string, rating: number) => {
    setFeedbackData(prev => ({
      ...prev,
      [imageId]: {
        ...prev[imageId] || { rating: null, textAccuracy: null, issues: [], notes: '' },
        rating
      }
    }));
  };

  const setTextAccuracy = (imageId: string, accuracy: 'perfect' | 'minor_issues' | 'major_issues') => {
    setFeedbackData(prev => ({
      ...prev,
      [imageId]: {
        ...prev[imageId] || { rating: null, textAccuracy: null, issues: [], notes: '' },
        textAccuracy: accuracy
      }
    }));
  };

  const setNotes = (imageId: string, notes: string) => {
    setFeedbackData(prev => ({
      ...prev,
      [imageId]: {
        ...prev[imageId] || { rating: null, textAccuracy: null, issues: [], notes: '' },
        notes
      }
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center space-y-4">
          <XCircle className="w-16 h-16 text-destructive mx-auto" />
          <p className="text-foreground font-semibold">No images found</p>
          <p className="text-sm text-muted-foreground">The project may still be processing or encountered an error.</p>
        </div>
      </div>
    );
  }

  const failedImages = images.filter(img => img.status === "failed");
  const completedImages = images.filter(img => img.status === "completed");

  if (failedImages.length === images.length) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="max-w-2xl mx-auto text-center space-y-6 p-8">
          <XCircle className="w-20 h-20 text-destructive mx-auto" />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Processing Failed</h2>
            <p className="text-muted-foreground">
              All {failedImages.length} images failed to process due to a service restriction.
            </p>
          </div>
          
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-left">
            <h3 className="font-semibold text-foreground mb-2">Error Details:</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {failedImages[0].error_message || "Image generation service is not available in your region."}
            </p>
            <p className="text-xs text-muted-foreground">
              This limitation is imposed by the AI provider. Please contact support for alternative solutions.
            </p>
          </div>

          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            size="lg"
          >
            Start New Project
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle py-12">
      <div className="container max-w-7xl mx-auto px-6">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-foreground font-montserrat">
              Your Edited Images Are Ready!
            </h2>
            <p className="text-muted-foreground">
              {completedImages.length} of {images.length} image{images.length !== 1 ? "s" : ""} processed successfully
              {failedImages.length > 0 && (
                <span className="text-destructive ml-2">
                  ({failedImages.length} failed)
                </span>
              )}
            </p>
            <Button
              onClick={handleDownloadAll}
              size="lg"
              className="bg-primary hover:bg-primary/90"
            >
              <Download className="w-5 h-5 mr-2" />
              Download All Images
            </Button>
          </div>

          {/* Image Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedImages.map((img) => (
              <div
                key={img.id}
                className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-all group"
              >
                {/* Image Comparison with Interactive Slider */}
                <div className="relative aspect-[4/3] overflow-hidden group">
                  <BeforeAfterSlider
                    beforeImage={img.original_url}
                    afterImage={img.edited_url}
                    beforeLabel="Before"
                    afterLabel="After"
                    className="w-full h-full"
                  />
                  
                  {/* Fullscreen Button */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0">
                      <BeforeAfterSlider
                        beforeImage={img.original_url}
                        afterImage={img.edited_url}
                        beforeLabel="Before"
                        afterLabel="After"
                        className="w-full h-full"
                      />
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Info Section */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-foreground text-sm uppercase">
                      {img.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {img.subtitle}
                    </p>
                  </div>

                  {/* Accuracy Badge */}
                  {img.text_accuracy_score !== null && (
                    <div className="flex items-center gap-2">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                        img.text_accuracy_score >= 95 ? 'bg-green-500/20 text-green-700 dark:text-green-400' :
                        img.text_accuracy_score >= 85 ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' :
                        'bg-red-500/20 text-red-700 dark:text-red-400'
                      }`}>
                        {img.text_accuracy_score >= 95 ? '✓ Verified' :
                         img.text_accuracy_score >= 85 ? '⚠ Review Recommended' :
                         '⚠ Needs Review'}
                        <span className="ml-1">{img.text_accuracy_score.toFixed(1)}%</span>
                      </div>
                      {img.retry_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({img.retry_count + 1} attempt{img.retry_count > 0 ? 's' : ''})
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Image {img.image_number}
                    </span>
                    <span className="text-muted-foreground">
                      {(img.processing_time_ms / 1000).toFixed(1)}s
                    </span>
                  </div>

                  <Button
                    onClick={() =>
                      handleDownload(img.edited_url, `${img.asset_name}_edited.jpg`)
                    }
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>

                  {/* Quick Feedback */}
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button
                      onClick={() => handleQuickFeedback(img.id, 5, 'perfect')}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      title="Perfect!"
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleQuickFeedback(img.id, 2, 'major_issues')}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      title="Needs work"
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => setExpandedFeedback(expandedFeedback === img.id ? null : img.id)}
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                    >
                      {expandedFeedback === img.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      Details
                    </Button>
                  </div>

                  {/* Detailed Feedback Form */}
                  {expandedFeedback === img.id && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-3">
                      <div>
                        <Label className="text-xs font-semibold mb-2 block">Rating</Label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setRating(img.id, star)}
                              className={`text-2xl ${
                                (feedbackData[img.id]?.rating || 0) >= star
                                  ? 'text-yellow-500'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold mb-2 block">Text Accuracy</Label>
                        <div className="flex gap-2">
                          {[
                            { value: 'perfect', label: 'Perfect' },
                            { value: 'minor_issues', label: 'Minor Issues' },
                            { value: 'major_issues', label: 'Major Issues' }
                          ].map((option) => (
                            <Button
                              key={option.value}
                              onClick={() => setTextAccuracy(img.id, option.value as any)}
                              variant={feedbackData[img.id]?.textAccuracy === option.value ? 'default' : 'outline'}
                              size="sm"
                              className="flex-1 text-xs"
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold mb-2 block">Issues</Label>
                        <div className="space-y-2">
                          {[
                            { id: 'wrong_title', label: 'Title has errors' },
                            { id: 'wrong_subtitle', label: 'Subtitle has errors' },
                            { id: 'text_color', label: 'Text color is wrong' },
                            { id: 'text_positioning', label: 'Text positioning is off' },
                            { id: 'gradient_issues', label: 'Gradient is too dark/light' }
                          ].map((issue) => (
                            <div key={issue.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`${img.id}-${issue.id}`}
                                checked={feedbackData[img.id]?.issues.includes(issue.id)}
                                onCheckedChange={() => toggleIssue(img.id, issue.id)}
                              />
                              <Label
                                htmlFor={`${img.id}-${issue.id}`}
                                className="text-xs cursor-pointer"
                              >
                                {issue.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold mb-2 block">Additional Notes</Label>
                        <Textarea
                          value={feedbackData[img.id]?.notes || ''}
                          onChange={(e) => setNotes(img.id, e.target.value)}
                          placeholder="Any other feedback..."
                          className="text-xs min-h-[60px]"
                        />
                      </div>

                      <Button
                        onClick={() => handleDetailedFeedback(img.id)}
                        size="sm"
                        className="w-full"
                      >
                        Submit Feedback
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* New Project Button */}
          <div className="flex justify-center pt-6">
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              size="lg"
            >
              Start New Project
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
