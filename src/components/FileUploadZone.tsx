import { Upload, FileText, X } from "lucide-react";
import { useState, useCallback } from "react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept: string;
  multiple?: boolean;
  maxSize?: number; // in MB
  title: string;
  description: string;
  icon?: React.ReactNode;
  files?: File[];
  onRemoveFile?: (index: number) => void;
}

export const FileUploadZone = ({
  onFilesSelected,
  accept,
  multiple = false,
  maxSize = 10,
  title,
  description,
  icon,
  files = [],
  onRemoveFile,
}: FileUploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string>("");

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const validateFiles = (fileList: FileList): File[] => {
    const validFiles: File[] = [];
    const maxSizeBytes = maxSize * 1024 * 1024;

    Array.from(fileList).forEach((file) => {
      if (file.size > maxSizeBytes) {
        setError(`File ${file.name} exceeds ${maxSize}MB limit`);
        return;
      }
      validFiles.push(file);
    });

    return validFiles;
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setError("");

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const validFiles = validateFiles(e.dataTransfer.files);
        if (validFiles.length > 0) {
          onFilesSelected(validFiles);
        }
      }
    },
    [onFilesSelected, maxSize]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = validateFiles(e.target.files);
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 transition-all",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50",
          files.length > 0 ? "bg-muted/50" : "bg-card"
        )}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
      <input
        type="file"
        onChange={handleChange}
        accept={accept}
        multiple={multiple}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        id={`file-upload-${title}`}
      />
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className="p-3 rounded-full bg-primary/10">
            {icon || <Upload className="w-8 h-8 text-primary" />}
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Max size: {maxSize}MB
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-card border border-border rounded-md hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              {onRemoveFile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveFile(index)}
                  className="flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
