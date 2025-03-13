import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { X, Upload, ImageIcon, CheckCircle2 } from "lucide-react";

interface MultiImageUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImagesConfirm: (images: File[], coverImageIndex?: number) => void;
  existingImages?: File[];
  maxImages?: number;
}

export function MultiImageUpload({
  open,
  onOpenChange,
  onImagesConfirm,
  existingImages = [],
  maxImages = 5
}: MultiImageUploadProps) {
  const { toast } = useToast();
  const [images, setImages] = useState<File[]>(existingImages);
  const [coverImageIndex, setCoverImageIndex] = useState<number>(0);
  
  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file types and sizes
    const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    
    const invalidTypeFiles = files.filter(file => !ALLOWED_FILE_TYPES.includes(file.type));
    if (invalidTypeFiles.length > 0) {
      toast({
        title: "Invalid File Type",
        description: "Please upload only JPG, PNG, or WebP images.",
        variant: "destructive",
      });
      return;
    }
    
    const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      toast({
        title: "File Too Large",
        description: `${oversizedFiles.length} image(s) exceed the 5MB limit.`,
        variant: "destructive",
      });
      return;
    }
    
    // Check if adding these files would exceed the maximum
    if (images.length + files.length > maxImages) {
      toast({
        title: "Too Many Images",
        description: `You can upload a maximum of ${maxImages} images.`,
        variant: "destructive",
      });
      return;
    }
    
    // Add the new files
    setImages(prev => [...prev, ...files]);
    
    // Reset the input
    e.target.value = '';
  };
  
  // Remove an image
  const removeImage = (index: number) => {
    // If removing the cover image, reset cover to the first image
    if (index === coverImageIndex) {
      if (images.length > 1) {
        // Set to first image or next image if first is being removed
        setCoverImageIndex(index === 0 && images.length > 1 ? 1 : 0);
      }
    } else if (index < coverImageIndex) {
      // If removing an image before the cover, adjust the cover index
      setCoverImageIndex(coverImageIndex - 1);
    }
    
    setImages(prev => prev.filter((_, i) => i !== index));
  };
  
  // Set an image as the cover
  const setCoverImage = (index: number) => {
    setCoverImageIndex(index);
    toast({
      title: "Cover Image Set",
      description: "This image will be displayed as the main image for your listing.",
    });
  };
  
  // Clear all images
  const clearImages = () => {
    setImages([]);
    setCoverImageIndex(0);
  };
  
  // Confirm selection
  const confirmImages = () => {
    onImagesConfirm(images, coverImageIndex);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Images</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Image preview area */}
          <div className="grid grid-cols-3 gap-2">
            {images.map((image, index) => (
              <div key={index} className="relative group">
                <img 
                  src={URL.createObjectURL(image)} 
                  alt={`Upload ${index + 1}`} 
                  className={`w-full h-24 object-cover rounded-md cursor-pointer ${index === coverImageIndex ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  onClick={() => setCoverImage(index)}
                />
                {index === coverImageIndex && (
                  <div className="absolute top-1 left-1 bg-primary text-white rounded-full p-1">
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
                  }}
                  className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            
            {/* Upload button if under max images */}
            {images.length < maxImages && (
              <label 
                htmlFor="multi-image-upload"
                className="flex items-center justify-center w-full h-24 bg-muted rounded-md hover:bg-muted/80 transition-colors cursor-pointer border-2 border-dashed border-muted-foreground/20"
              >
                <div className="flex flex-col items-center">
                  <Upload className="h-5 w-5 mb-1 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Add Image</span>
                </div>
                <input
                  id="multi-image-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                  multiple
                />
              </label>
            )}
          </div>
          
          {/* Status and info */}
          <div className="text-sm text-muted-foreground">
            {images.length} of {maxImages} images selected
          </div>
          
          {/* Instructions */}
          <div className="text-sm bg-muted p-3 rounded-md">
            <p><strong>Cover Image:</strong> Click on an image to set it as the cover image (highlighted with a ring).</p>
            <p className="mt-1">To remove an image, hover over it and click the X button.</p>
            <p className="mt-1">Images must be JPG, PNG, or WebP format and under 5MB each.</p>
          </div>
        </div>
        
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={clearImages}
            disabled={images.length === 0}
          >
            Clear All
          </Button>
          <Button
            type="button"
            onClick={confirmImages}
          >
            Confirm Images
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}