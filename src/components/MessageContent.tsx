import React, { useState } from 'react';
import { Link, AlertCircle, Image as ImageIcon } from 'lucide-react';

interface MessageContentProps {
  content: string;
  className?: string;
}

export function MessageContent({ content, className = '' }: MessageContentProps) {
  const [imageError, setImageError] = useState(false);
  
  // Handle undefined or null content
  if (!content) {
    return <div className={`whitespace-pre-wrap break-words max-w-full ${className}`}>
      <span className="text-muted-foreground italic">No message content</span>
    </div>;
  }
  
  // URL regex pattern
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  
  // Split content by URLs
  const parts = content.split(urlPattern);
  
  // Check if content is an image markdown
  const imageMatch = content.match(/!\[.*?\]\((.*?)\)/);
  if (imageMatch) {
    const imageUrl = imageMatch[1];
    
    if (imageError) {
      return (
        <div className={`max-w-full ${className} p-3 bg-muted/30 rounded-lg flex items-center gap-2 text-sm text-muted-foreground`}>
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <span>Image failed to load. It may have been deleted or you may not have permission to view it.</span>
        </div>
      );
    }
    
    return (
      <div className={`max-w-full ${className}`}>
        <img 
          src={imageUrl} 
          alt="Message attachment" 
          className="max-w-full h-auto rounded-lg"
          loading="lazy"
          onError={() => {
            console.error(`Failed to load image: ${imageUrl}`);
            setImageError(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className={`whitespace-pre-wrap break-words max-w-full ${className}`}>
      {parts.map((part, index) => {
        if (part.match(urlPattern)) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline inline-flex items-center gap-1"
            >
              <Link className="h-3 w-3" />
              {part}
            </a>
          );
        }
        return part;
      })}
    </div>
  );
}