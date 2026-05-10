// @ts-nocheck
import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from './card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './collapsible';

interface CollapsibleCardProps extends React.HTMLAttributes<HTMLDivElement> {
  trigger?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function CollapsibleCard({ 
  trigger,
  title,
  description,
  defaultOpen = true,
  open,
  onOpenChange,
  children,
  className,
  ...props 
}: CollapsibleCardProps) {
  return (
    <Card className={className} {...props}>
      <Collapsible 
        defaultOpen={defaultOpen}
        open={open}
        onOpenChange={onOpenChange}
      >
        <CollapsibleTrigger asChild>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-4 cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex flex-col space-y-1.5">
              {title && <CardTitle className="text-base">{title}</CardTitle>}
              {description && <CardDescription className="text-sm">{description}</CardDescription>}
              {trigger && !title && trigger}
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
