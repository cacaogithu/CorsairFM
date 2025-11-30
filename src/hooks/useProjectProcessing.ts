import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BrandSettingsData {
  font: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  gradientColor: string;
  customPrompt?: string;
  platform?: string;
}

export const useProjectProcessing = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  const processProject = async (
    pdfFile: File,
    imageFiles: File[],
    brandSettings: BrandSettingsData
  ) => {
    setIsProcessing(true);

    try {
      // 1. Create project
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          name: `Project ${new Date().toLocaleDateString()}`,
          status: "uploading",
          pdf_filename: pdfFile.name,
          total_images: 0,
          brand_preset: brandSettings as any,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      setProjectId(project.id);
      console.log("Project created:", project.id);

      // 2. Upload PDF
      const pdfPath = `${project.id}/${pdfFile.name}`;
      const { error: pdfUploadError } = await supabase.storage
        .from("project-briefs")
        .upload(pdfPath, pdfFile);

      if (pdfUploadError) throw pdfUploadError;

      const { data: { publicUrl: pdfUrl } } = supabase.storage
        .from("project-briefs")
        .getPublicUrl(pdfPath);

      // Decode any double-encoded characters in the URL
      const cleanPdfUrl = pdfUrl.replace(/%2520/g, '%20');

      // Update project with PDF URL
      await supabase
        .from("projects")
        .update({ pdf_url: cleanPdfUrl, status: "parsing_pdf" })
        .eq("id", project.id);

      console.log("PDF uploaded:", cleanPdfUrl);

      // 3. Upload images
      const imageUrls: Array<{ filename: string; url: string }> = [];
      
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const imagePath = `${project.id}/${file.name}`;
        
        const { error: imageUploadError } = await supabase.storage
          .from("original-images")
          .upload(imagePath, file);

        if (imageUploadError) {
          console.error(`Failed to upload ${file.name}:`, imageUploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("original-images")
          .getPublicUrl(imagePath);

        imageUrls.push({ filename: file.name, url: publicUrl });
        console.log(`Image ${i + 1} uploaded:`, file.name);
      }

      // 4. Parse PDF or DOCX
      const isPdf = pdfFile.name.toLowerCase().endsWith('.pdf');
      const isDocx = pdfFile.name.toLowerCase().endsWith('.docx');
      
      if (!isPdf && !isDocx) {
        throw new Error('File must be either PDF or DOCX format');
      }

      toast.info(`Parsing ${isPdf ? 'PDF' : 'DOCX'} with AI...`);
      
      const parseFunction = isPdf ? 'parse-pdf' : 'parse-docx';
      const parseBody = isPdf 
        ? { pdfUrl: cleanPdfUrl, brandSettings }
        : { docxUrl: cleanPdfUrl, brandSettings, projectId: project.id };
      
      const { data: parseData, error: parseError } = await supabase.functions.invoke(parseFunction, {
        body: parseBody,
      });

      if (parseError) {
        console.error("Parsing error:", parseError);
        throw parseError;
      }

      if (!parseData || parseData.error) {
        console.error("Parsing failed:", parseData);
        throw new Error(parseData?.error || "Failed to parse document");
      }

      const parsedImages = parseData.images;
      
      // Handle extracted images from DOCX
      if (isDocx && parseData.extractedImages?.length > 0) {
        const extracted = parseData.extractedImages;
        console.log(`DOCX parsed: ${parsedImages.length} specs, ${extracted.length} images extracted`);
        toast.success(`Extracted ${extracted.length} images from DOCX`);
        
        // Add extracted images to imageUrls array
        for (const img of extracted) {
          imageUrls.push({ filename: img.filename, url: img.url });
        }
      } else {
        console.log(`Document parsed, found ${parsedImages.length} image specs`);
      }

      // 5. Create image records for ALL uploaded images with enhanced fuzzy matching
      const findBestSpecMatch = (
        filename: string, 
        parsedSpecs: any[], 
        documentOrder?: number
      ): any | null => {
        const cleanFilename = filename.toLowerCase()
          .replace(/[_-]/g, ' ')
          .replace(/\.(jpg|jpeg|png|webp)$/i, '');
        
        let bestMatch = { spec: null as any, score: 0 };
        
        for (const spec of parsedSpecs) {
          let score = 0;
          
          // Strategy 1: Asset name similarity (40 points max)
          const assetName = spec.asset.toLowerCase().replace(/[_-]/g, ' ');
          const assetWords = assetName.split(/\s+/);
          const filenameWords = cleanFilename.split(/\s+/);
          const matchingWords = assetWords.filter(word => 
            filenameWords.some(fw => fw.includes(word) || word.includes(fw))
          );
          score += (matchingWords.length / assetWords.length) * 40;
          
          // Strategy 2: Variant match (30 points)
          if (spec.variant && cleanFilename.includes(spec.variant.toLowerCase().replace(/\s+/g, ''))) {
            score += 30;
          }
          
          // Strategy 3: Image number match (30 points)
          const filenameNumbers = filename.match(/\d+/g)?.map(n => parseInt(n)) || [];
          if (filenameNumbers.includes(spec.image_number)) {
            score += 30;
          }
          
          // Strategy 4: Document order fallback (25 points if exact match)
          // This allows matching by position when filename matching fails
          if (documentOrder && documentOrder === spec.image_number) {
            score += 25;
          }
          
          if (score > bestMatch.score) {
            bestMatch = { spec, score };
          }
        }
        
        console.log(`Fuzzy match for ${filename}: score ${bestMatch.score.toFixed(1)}${documentOrder ? ` (doc order: ${documentOrder})` : ''}`);
        
        // Only return match if score is above threshold (25 points minimum)
        return bestMatch.score >= 25 ? bestMatch.spec : null;
      };
      
      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        
        // Check if this is an extracted image with document order
        const extractedImg = isDocx && parseData.extractedImages?.find(
          (img: any) => img.url === imageUrl.url
        );
        const documentOrder = extractedImg?.documentOrder;
        
        const matchedSpec = findBestSpecMatch(
          imageUrl.filename, 
          parsedImages,
          documentOrder
        );

        // Create record with spec data if available, otherwise use smart fallback
        await supabase.from("images").insert({
          project_id: project.id,
          image_number: i + 1,
          original_url: imageUrl.url,
          original_filename: imageUrl.filename,
          title: matchedSpec?.title || `[UNMATCHED: ${imageUrl.filename}]`,
          subtitle: matchedSpec?.subtitle || "No text overlay needed",
          asset_name: matchedSpec?.asset || imageUrl.filename,
          variant: matchedSpec?.variant || "default",
          ai_prompt: matchedSpec?.ai_prompt || `Analyze this image and add appropriate text overlay using ${brandSettings.font} font in ${brandSettings.textColor} color with a ${brandSettings.gradientColor} gradient background. Make it suitable for ${brandSettings.platform || 'web marketing'}.`,
          status: "queued",
        });
      }

      console.log("Image records created");

      // Update total_images to match all uploaded images
      await supabase
        .from("projects")
        .update({ total_images: imageUrls.length })
        .eq("id", project.id);

      console.log(`Updated total_images to ${imageUrls.length}`);

      // 6. Analyze images for optimal text placement
      toast.info("Analyzing images for optimal text placement...");
      
      const { data: allImages } = await supabase
        .from('images')
        .select('*')
        .eq('project_id', project.id)
        .order('image_number');

      if (allImages) {
        for (const img of allImages) {
          if (img.ai_prompt !== "Return the original image unchanged. Do not add any text overlays or modifications.") {
            const { data: analysisData } = await supabase.functions.invoke('analyze-image', {
              body: {
                imageUrl: img.original_url,
                imageId: img.id,
                title: img.title,
                subtitle: img.subtitle,
                basePrompt: img.ai_prompt
              }
            });
            
            if (analysisData?.enhanced_prompt) {
              await supabase
                .from('images')
                .update({ ai_prompt: analysisData.enhanced_prompt })
                .eq('id', img.id);
            }
          }
        }
      }

      // 7. Start processing images
      await supabase
        .from("projects")
        .update({ status: "processing_images" })
        .eq("id", project.id);

      toast.info("Processing images...");

      // Invoke processing function (background)
      supabase.functions.invoke("process-images", {
        body: { projectId: project.id },
      }).then(({ error }) => {
        if (error) {
          console.error("Processing error:", error);
          toast.error("Failed to process some images");
        }
      });

      return project.id;

    } catch (error) {
      console.error("Processing failed:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to process: ${errorMessage}`);
      setIsProcessing(false);
      setProjectId(null);
      throw error;
    }
  };

  return {
    processProject,
    isProcessing,
    projectId,
  };
};
