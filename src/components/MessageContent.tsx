import React from 'react';
import { Link } from 'lucide-react';

interface MessageContentProps {
  content: string;
  className?: string;
}

export function MessageContent({ content, className = '' }: MessageContentProps) {
  // URL regex pattern
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  
  // Split content by URLs
  const parts = content.split(urlPattern);
  
  return (
    <div className={`whitespace-pre-wrap break-words ${className}`}>
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