import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from './card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './collapsible';
export function CollapsibleCard({ trigger, title, description, defaultOpen = true, open, onOpenChange, children, className, ...props }) {
    return (_jsx(Card, { className: className, ...props, children: _jsxs(Collapsible, { defaultOpen: defaultOpen, open: open, onOpenChange: onOpenChange, children: [_jsx(CollapsibleTrigger, { asChild: true, children: _jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 py-4 cursor-pointer hover:bg-accent/50 transition-colors", children: [_jsxs("div", { className: "flex flex-col space-y-1.5", children: [title && _jsx(CardTitle, { className: "text-base", children: title }), description && _jsx(CardDescription, { className: "text-sm", children: description }), trigger && !title && trigger] }), _jsx(ChevronDown, { className: "h-4 w-4 shrink-0 transition-transform duration-200" })] }) }), _jsx(CollapsibleContent, { children: _jsx(CardContent, { className: "pt-0", children: children }) })] }) }));
}
