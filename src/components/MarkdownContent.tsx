import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import ReactMarkdown to avoid SSR issues
const ReactMarkdown = dynamic(() => import('react-markdown'), {
  ssr: false,
  loading: () => <p>Loading...</p>
});

interface MarkdownContentProps {
  content: string;
  className?: string;
  emptyMessage?: string;
}

export function MarkdownContent({ 
  content, 
  className = '', 
  emptyMessage = 'No description provided.' 
}: MarkdownContentProps) {
  // Handle empty, null, or undefined content
  if (!content || content.trim() === '') {
    return (
      <div className={`text-muted-foreground italic ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  // If the content doesn't contain any markdown syntax, render it as plain text
  const hasMarkdown = /[*#\[\]()!\-`]/.test(content);

  if (!hasMarkdown) {
    return (
      <div className={`whitespace-pre-wrap break-words overflow-wrap-anywhere overflow-hidden ${className}`}>
        {content}
      </div>
    );
  }

  return (
    <div className={`prose dark:prose-invert max-w-none break-words overflow-wrap-anywhere overflow-hidden ${className}`}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}