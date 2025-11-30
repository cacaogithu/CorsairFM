import { useState } from "react";
import { FileText, Image as ImageIcon, Sparkles, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUploadZone } from "@/components/FileUploadZone";
import { BrandSettings, BrandSettingsData } from "@/components/BrandSettings";
import { ProcessingView } from "@/components/ProcessingView";
import { ProjectHistory } from "@/components/ProjectHistory";
import { useProjectProcessing } from "@/hooks/useProjectProcessing";
import { toast } from "sonner";
import corsairLogo from "@/assets/corsair-logo.png";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [brandSettings, setBrandSettings] = useState<BrandSettingsData>({
    font: "montserrat",
    primaryColor: "#000000",
    secondaryColor: "#FFCD00",
    textColor: "#FFFFFF",
    gradientColor: "#000000",
    customPrompt: "",
    platform: "none",
  });

  const { processProject, isProcessing, projectId } = useProjectProcessing();

  const handlePdfUpload = (files: File[]) => {
    if (files.length > 0) {
      setPdfFile(files[0]);
      toast.success(`PDF uploaded: ${files[0].name}`);
    }
  };

  const handleImagesUpload = (files: File[]) => {
    setImageFiles((prev) => [...prev, ...files]);
    toast.success(`${files.length} image(s) uploaded`);
  };

  const handleRemovePdf = () => {
    setPdfFile(null);
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveAllImages = () => {
    setImageFiles([]);
    toast.success("All images removed");
  };

  const handleStartEditing = async () => {
    if (!pdfFile) {
      toast.error("Please upload a creative brief (PDF or DOCX)");
      return;
    }
    
    const isDocx = pdfFile.name.toLowerCase().endsWith('.docx');
    if (!isDocx && imageFiles.length === 0) {
      toast.error("Please upload at least one image (or use DOCX with embedded images)");
      return;
    }

    try {
      await processProject(pdfFile, imageFiles, brandSettings);
    } catch (error) {
      console.error("Failed to start processing:", error);
    }
  };

  const canStartEditing = pdfFile !== null && (imageFiles.length > 0 || pdfFile.name.toLowerCase().endsWith('.docx'));

  // Show history view
  if (showHistory) {
    return (
      <ProjectHistory
        onBack={() => setShowHistory(false)}
        onSelectProject={(id) => {
          // Could navigate to ProcessingView with this ID
          toast.info(`Selected project: ${id}`);
        }}
      />
    );
  }

  // Show processing view if we have a project
  if (projectId) {
    return <ProcessingView projectId={projectId} />;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-gradient-hero backdrop-blur-sm sticky top-0 z-10 shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={corsairLogo} alt="CORSAIR" className="h-8 w-auto" />
              <div className="h-8 w-px bg-secondary/30"></div>
              <h1 className="text-xl font-bold text-primary-foreground font-montserrat tracking-tight">
                AI Image Editor
              </h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-secondary/30 hover:border-secondary hover:bg-secondary/10 mr-2"
              onClick={() => navigate('/test')}
            >
              <TestTube className="w-4 h-4 mr-2" />
              <span className="text-primary-foreground">Run Tests</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-secondary/30 hover:border-secondary hover:bg-secondary/10"
              onClick={() => setShowHistory(true)}
            >
              <span className="text-primary-foreground">View History</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-3 mb-8 animate-fade-in">
            <h2 className="text-4xl font-bold text-foreground font-montserrat">
              Upload Your Creative Brief
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Upload your PDF/DOCX brief with embedded images, or upload images separately
            </p>
          </div>

          {/* Upload Grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* PDF Upload */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">
                  Creative Brief
                </h3>
              </div>
              <FileUploadZone
                onFilesSelected={handlePdfUpload}
                accept=".pdf,.docx"
                multiple={false}
                maxSize={50}
                title="Upload PDF or DOCX Brief"
                description="Drag & drop or click to browse"
                icon={<FileText className="w-8 h-8 text-primary" />}
                files={pdfFile ? [pdfFile] : []}
                onRemoveFile={handleRemovePdf}
              />
              {pdfFile?.name.toLowerCase().endsWith('.docx') && (
                <p className="text-xs text-muted-foreground mt-2 px-2">
                  💡 DOCX with embedded images? We'll extract them automatically!
                </p>
              )}
            </div>

            {/* Images Upload */}
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">
                    Product Images
                  </h3>
                </div>
                {imageFiles.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveAllImages}
                    className="text-destructive hover:text-destructive"
                  >
                    Remove All
                  </Button>
                )}
              </div>
              <FileUploadZone
                onFilesSelected={handleImagesUpload}
                accept=".jpg,.jpeg,.png"
                multiple={true}
                maxSize={50}
                title="Upload Product Images (Optional)"
                description={`Upload images separately or use DOCX with embedded images (${imageFiles.length} uploaded)`}
                icon={<ImageIcon className="w-8 h-8 text-primary" />}
                files={imageFiles}
                onRemoveFile={handleRemoveImage}
              />
            </div>
          </div>

          {/* Brand Settings */}
          <div className="max-w-2xl mx-auto">
            <BrandSettings
              settings={brandSettings}
              onChange={setBrandSettings}
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-center pt-6">
            <Button
              size="lg"
              onClick={handleStartEditing}
              disabled={!canStartEditing}
              className="bg-primary hover:bg-primary/90 hover:shadow-yellow transition-all px-8 py-6 text-base font-bold font-montserrat group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-secondary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Sparkles className="w-5 h-5 mr-2 relative z-10 group-hover:rotate-12 transition-transform" />
              <span className="relative z-10">Start AI Editing</span>
              {canStartEditing && (
                <span className="ml-2 text-sm opacity-90 relative z-10">
                  ({imageFiles.length} {imageFiles.length === 1 ? "image" : "images"})
                </span>
              )}
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t bg-gradient-hero">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col items-center gap-4">
            <img src={corsairLogo} alt="CORSAIR" className="h-6 w-auto opacity-80" />
            <p className="text-center text-xs text-muted-foreground">
              © 2025 CORSAIR. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
