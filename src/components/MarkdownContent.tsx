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
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  // If the content doesn't contain any markdown syntax, render it as plain text
  const hasMarkdown = /[*#\[\]()!\-`]/.test(content);

  if (!hasMarkdown) {
    return (
      <div className={`whitespace-pre-wrap ${className}`}>
        {content}
      </div>
    );
  }

  return (
    <div className={`prose dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}