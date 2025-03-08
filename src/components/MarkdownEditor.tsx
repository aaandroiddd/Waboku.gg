import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading2, 
  Link as LinkIcon, 
  Image as ImageIcon,
  HelpCircle,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';
import { MarkdownContent } from './MarkdownContent';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  error?: string;
  className?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  maxLength = 2000,
  placeholder = 'Provide detailed information about your card',
  error,
  className = ''
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<string>('edit');
  const [toolbarExpanded, setToolbarExpanded] = useState(true);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('markdown-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const beforeText = value.substring(0, start);
    const afterText = value.substring(end);

    const newValue = beforeText + prefix + selectedText + suffix + afterText;
    onChange(newValue);

    // Set cursor position after the operation
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        end + prefix.length
      );
    }, 0);
  };

  const handleBold = () => insertMarkdown('**', '**');
  const handleItalic = () => insertMarkdown('*', '*');
  const handleHeading = () => insertMarkdown('## ');
  const handleBulletList = () => insertMarkdown('- ');
  const handleNumberedList = () => insertMarkdown('1. ');
  
  const handleLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      const text = prompt('Enter link text:', url);
      insertMarkdown(`[${text || url}](`, `${url})`);
    }
  };

  const handleImage = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      const alt = prompt('Enter image description:', 'Image');
      insertMarkdown(`![${alt || 'Image'}](`, `${url})`);
    }
  };

  const markdownGuide = `
## Markdown Guide

### Basic Formatting
**Bold text** = \`**Bold text**\`
*Italic text* = \`*Italic text*\`
## Heading = \`## Heading\`

### Lists
- Bullet item = \`- Bullet item\`
1. Numbered item = \`1. Numbered item\`

### Links and Images
[Link text](https://example.com) = \`[Link text](https://example.com)\`
![Image alt text](https://example.com/image.jpg) = \`![Image alt text](https://example.com/image.jpg)\`
  `;

  // Render toolbar based on screen size
  const renderToolbar = () => {
    const toolbarButtons = (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 w-8 flex-shrink-0" 
                onClick={handleBold}
              >
                <Bold className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bold</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 w-8 flex-shrink-0" 
                onClick={handleItalic}
              >
                <Italic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Italic</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 w-8 flex-shrink-0" 
                onClick={handleHeading}
              >
                <Heading2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Heading</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 w-8 flex-shrink-0" 
                onClick={handleBulletList}
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bullet List</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 w-8 flex-shrink-0" 
                onClick={handleNumberedList}
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Numbered List</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 w-8 flex-shrink-0" 
                onClick={handleLink}
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert Link</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 w-8 flex-shrink-0" 
                onClick={handleImage}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert Image</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </>
    );

    if (isMobile) {
      return (
        <div className="relative">
          {activeTab === 'edit' && (
            <div className="absolute bottom-0 left-0 right-0 bg-background border-t border-border z-10 p-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted-foreground">Formatting Tools</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0" 
                  onClick={() => setToolbarExpanded(!toolbarExpanded)}
                >
                  {toolbarExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              </div>
              
              {toolbarExpanded && (
                <div className="flex flex-wrap gap-1 justify-center">
                  {toolbarButtons}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex space-x-1">
        {toolbarButtons}
      </div>
    );
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Tabs defaultValue="edit" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center mb-2">
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="guide">Guide</TabsTrigger>
          </TabsList>
          
          {activeTab === 'edit' && !isMobile && renderToolbar()}
        </div>
        
        <TabsContent value="edit" className="mt-0">
          <div className="relative">
            <Textarea
              id="markdown-textarea"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              maxLength={maxLength}
              className={`min-h-[180px] ${isMobile ? 'pb-16' : 'min-h-[120px]'} ${error ? "border-red-500" : ""}`}
            />
            {isMobile && renderToolbar()}
          </div>
        </TabsContent>
        
        <TabsContent value="preview" className="mt-0">
          <Card className="p-4 min-h-[120px] overflow-auto">
            {value ? (
              <MarkdownContent content={value} />
            ) : (
              <div className="text-muted-foreground italic">
                Preview will appear here...
              </div>
            )}
          </Card>
        </TabsContent>
        
        <TabsContent value="guide" className="mt-0">
          <Card className="p-4 min-h-[120px] overflow-auto text-sm">
            <MarkdownContent content={markdownGuide} />
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-between text-sm">
        {error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <p className="text-muted-foreground">
            {value.length}/{maxLength} characters
          </p>
        )}
        
        <div className="flex items-center text-muted-foreground">
          <HelpCircle className="h-4 w-4 mr-1" />
          <span>Premium feature: Markdown formatting</span>
        </div>
      </div>
    </div>
  );
}