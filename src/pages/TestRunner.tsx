import { useState } from "react";
import { useProjectProcessing } from "@/hooks/useProjectProcessing";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Clock, Upload } from "lucide-react";
import { toast } from "sonner";

interface TestResult {
  projectId?: string;
  uploadSuccess: boolean;
  pdfParsed: boolean;
  imagesMatched: number;
  totalImages: number;
  processingComplete: boolean;
  errors: string[];
  timings: {
    upload: number;
    parsing: number;
    processing: number;
  };
  imageResults: Array<{
    filename: string;
    status: string;
    hasTitle: boolean;
    hasSubtitle: boolean;
    processingTime?: number;
    originalUrl?: string;
    editedUrl?: string;
    title?: string;
    subtitle?: string;
  }>;
}

export default function TestRunner() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [useUploadedFiles, setUseUploadedFiles] = useState(false);
  const [uploadedPdf, setUploadedPdf] = useState<File | null>(null);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const { processProject } = useProjectProcessing();

  const runTest = async () => {
    setIsRunning(true);
    setProgress(0);
    setTestResult(null);
    
    const result: TestResult = {
      uploadSuccess: false,
      pdfParsed: false,
      imagesMatched: 0,
      totalImages: 0,
      processingComplete: false,
      errors: [],
      timings: { upload: 0, parsing: 0, processing: 0 },
      imageResults: []
    };

    try {
      let pdfFile: File;
      let imageFiles: File[];

      if (useUploadedFiles) {
        // Use uploaded files
        setCurrentStep('Using uploaded files...');
        
        if (!uploadedPdf) {
          throw new Error('Please upload a PDF or DOCX file.');
        }
        if (uploadedImages.length === 0) {
          throw new Error('Please upload at least one image.');
        }
        
        pdfFile = uploadedPdf;
        imageFiles = uploadedImages;
      } else {
        // Fetch from storage
        setCurrentStep('Loading test files from storage...');
        
        const { data: pdfBlob, error: pdfError } = await supabase.storage
          .from('project-briefs')
          .download('test-files/sample-brief.pdf');
        
        if (pdfError) {
          throw new Error('Test PDF not found. Please upload test-files/sample-brief.pdf to the project-briefs bucket.');
        }
        
        pdfFile = new File([pdfBlob], 'test-brief.pdf', { type: 'application/pdf' });

        const testImageNames = [
          'CORSAIR_ONE_i600_DARK_METAL_12.jpg',
          'CORSAIR_ONE_i600_WOOD_DARK_PHOTO_17.jpg',
          'CORSAIR_ONE_i600_DARK_METAL_49.jpg',
          'CORSAIR_ONE_i600_WOOD_DARK_PHOTO_65.jpg',
          'CORSAIR_ONE_i600_DARK_METAL_84.jpg',
          'CORSAIR_ONE_i600_WOOD_DARK_PHOTO_97.jpg',
          'CORSAIR_ONE_i600_DARK_METAL_110.jpg',
          'CORSAIR_ONE_i600_WOOD_DARK_PHOTO_123.jpg',
        ];
        
        imageFiles = [];
        for (const imageName of testImageNames) {
          const { data: imgBlob, error: imgError } = await supabase.storage
            .from('original-images')
            .download(`test-files/${imageName}`);
          
          if (!imgError && imgBlob) {
            imageFiles.push(new File([imgBlob], imageName, { type: 'image/jpeg' }));
          }
        }
        
        if (imageFiles.length === 0) {
          throw new Error('No test images found. Please upload test images to original-images/test-files/ bucket with names matching PDF specs.');
        }
      }

      setCurrentStep(`Loaded ${imageFiles.length} test images`);
      
      result.totalImages = imageFiles.length;
      
      // Upload and process
      setCurrentStep("Uploading files...");
      setProgress(30);
      
      const startUpload = Date.now();
      const projectId = await processProject(
        pdfFile,
        imageFiles,
        {
          font: "montserrat",
          primaryColor: "#000000",
          secondaryColor: "#FFCD00",
          textColor: "#FFFFFF",
          gradientColor: "#000000",
          platform: "Amazon"
        }
      );
      result.timings.upload = Date.now() - startUpload;
      result.uploadSuccess = true;
      result.projectId = projectId;
      
      setProgress(50);
      setCurrentStep("Waiting for PDF parsing...");
      
      // Poll for project status
      const startParsing = Date.now();
      let attempts = 0;
      const maxAttempts = 60;
      
      while (attempts < maxAttempts) {
        const { data: project } = await supabase
          .from('projects')
          .select('status')
          .eq('id', projectId)
          .single();
        
        if (project?.status === 'processing_images' || project?.status === 'completed') {
          result.pdfParsed = true;
          result.timings.parsing = Date.now() - startParsing;
          break;
        }
        
        if (project?.status === 'failed') {
          result.errors.push('PDF parsing failed');
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        setProgress(50 + (attempts / maxAttempts) * 20);
      }
      
      setProgress(70);
      setCurrentStep("Waiting for image processing...");
      
      // Wait for image processing to complete
      const startProcessing = Date.now();
      attempts = 0;
      
      while (attempts < 120) {
        const { data: images } = await supabase
          .from('images')
          .select('id, status, original_filename, title, subtitle, processing_time_ms, original_url, edited_url')
          .eq('project_id', projectId);
        
        if (images) {
          const completed = images.filter(img => 
            img.status === 'completed' || img.status === 'failed'
          ).length;
          
          result.imagesMatched = images.length;
          result.imageResults = images.map(img => ({
            filename: img.original_filename,
            status: img.status,
            hasTitle: !!img.title,
            hasSubtitle: !!img.subtitle,
            processingTime: img.processing_time_ms,
            originalUrl: img.original_url,
            editedUrl: img.edited_url,
            title: img.title || undefined,
            subtitle: img.subtitle || undefined
          }));
          
          if (completed === images.length) {
            result.processingComplete = true;
            result.timings.processing = Date.now() - startProcessing;
            break;
          }
          
          setProgress(70 + (completed / images.length) * 25);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
      
      setProgress(100);
      setCurrentStep("Test complete!");
      
      // Calculate success metrics
      const successfulImages = result.imageResults.filter(img => 
        img.status === 'completed' && img.hasTitle && img.hasSubtitle
      ).length;
      
      if (successfulImages === result.totalImages) {
        toast.success(`Test passed! All ${successfulImages} images processed successfully.`);
      } else {
        toast.warning(`Test partial: ${successfulImages}/${result.totalImages} images succeeded.`);
      }
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      toast.error("Test failed: " + result.errors.join(", "));
    } finally {
      setTestResult(result);
      setIsRunning(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Automated Testing</CardTitle>
          <CardDescription>
            Test the complete workflow: PDF/DOCX upload → parsing → image matching → processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 mb-4">
                <Switch
                  checked={useUploadedFiles}
                  onCheckedChange={setUseUploadedFiles}
                />
                <Label>Use uploaded files instead of storage test files</Label>
              </div>
              
              {useUploadedFiles && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="pdf-upload">Upload Test PDF/DOCX</Label>
                    <Input
                      id="pdf-upload"
                      type="file"
                      accept=".pdf,.docx"
                      onChange={(e) => setUploadedPdf(e.target.files?.[0] || null)}
                      className="mt-2"
                    />
                    {uploadedPdf && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Selected: {uploadedPdf.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="images-upload">Upload Test Images</Label>
                    <Input
                      id="images-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setUploadedImages(Array.from(e.target.files || []))}
                      className="mt-2"
                    />
                    {uploadedImages.length > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Selected: {uploadedImages.length} image(s)
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button 
              onClick={runTest} 
              disabled={isRunning || (useUploadedFiles && (!uploadedPdf || uploadedImages.length === 0))}
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Running Test...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Run Full System Test
                </>
              )}
            </Button>
          </div>

          {isRunning && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{currentStep}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {testResult && (
            <div className="space-y-4 mt-6 p-4 border rounded-lg">
              <h3 className="font-semibold text-lg">Test Results</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  {testResult.uploadSuccess ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span>File Upload</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {testResult.pdfParsed ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span>PDF/DOCX Parsing</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {testResult.imagesMatched === testResult.totalImages ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span>Image Matching ({testResult.imagesMatched}/{testResult.totalImages})</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {testResult.processingComplete ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span>Processing Complete</span>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="font-medium mb-2">Timings</h4>
                <div className="text-sm space-y-1">
                  <p>Upload: {(testResult.timings.upload / 1000).toFixed(2)}s</p>
                  <p>Parsing: {(testResult.timings.parsing / 1000).toFixed(2)}s</p>
                  <p>Processing: {(testResult.timings.processing / 1000).toFixed(2)}s</p>
                  <p className="font-semibold">
                    Total: {((testResult.timings.upload + testResult.timings.parsing + testResult.timings.processing) / 1000).toFixed(2)}s
                  </p>
                </div>
              </div>

              {testResult.imageResults.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Image Results</h4>
                  <div className="space-y-4">
                    {testResult.imageResults.map((img, idx) => (
                      <div key={idx} className="border rounded-lg p-4 bg-card">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{img.filename}</span>
                            <span className={`text-sm px-2 py-0.5 rounded ${
                              img.status === 'completed' 
                                ? 'bg-green-500/10 text-green-500' 
                                : 'bg-red-500/10 text-red-500'
                            }`}>
                              {img.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {img.processingTime && (
                              <span>{(img.processingTime / 1000).toFixed(1)}s</span>
                            )}
                            {img.hasTitle && <CheckCircle className="h-4 w-4 text-green-500" />}
                          </div>
                        </div>
                        
                        {img.title && img.subtitle && (
                          <div className="mb-3 text-sm">
                            <div className="font-semibold">{img.title}</div>
                            <div className="text-muted-foreground">{img.subtitle}</div>
                          </div>
                        )}
                        
                        {img.status === 'completed' && img.editedUrl ? (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs font-medium mb-2 text-muted-foreground">Original</div>
                              <img 
                                src={img.originalUrl} 
                                alt={`Original ${img.filename}`}
                                className="w-full h-48 object-cover rounded border"
                              />
                            </div>
                            <div>
                              <div className="text-xs font-medium mb-2 text-muted-foreground">Edited</div>
                              <img 
                                src={img.editedUrl} 
                                alt={`Edited ${img.filename}`}
                                className="w-full h-48 object-cover rounded border"
                              />
                            </div>
                          </div>
                        ) : img.originalUrl ? (
                          <div>
                            <div className="text-xs font-medium mb-2 text-muted-foreground">Original</div>
                            <img 
                              src={img.originalUrl} 
                              alt={img.filename}
                              className="w-full h-48 object-contain rounded border"
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {testResult.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2 text-red-500">Errors</h4>
                  <ul className="text-sm space-y-1 text-red-500">
                    {testResult.errors.map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {testResult.projectId && (
                <div className="mt-4 p-3 bg-muted rounded text-sm">
                  <span className="font-medium">Project ID:</span> {testResult.projectId}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
