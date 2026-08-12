import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Circle, Square, Play, Undo, Redo, Download, Target } from 'lucide-react';
export const TransportControls = memo(function TransportControls({ isArmed, isRecording, isPlaying, recordedEventsCount, onArm, onRecord, onStop, onPlay, onUndo, onRedo, onExport, }) {
    // Guard: only fire onRecord if not already recording
    const handleRecord = useCallback(() => {
        if (!isRecording)
            onRecord();
    }, [isRecording, onRecord]);
    // Guard: only fire onPlay if not already playing
    const handlePlay = useCallback(() => {
        if (!isPlaying)
            onPlay();
    }, [isPlaying, onPlay]);
    const hasEvents = recordedEventsCount > 0;
    return (_jsxs("div", { className: "flex flex-wrap items-center justify-center gap-2", children: [_jsxs(Button, { variant: isArmed ? 'default' : 'outline', size: "sm", onClick: onArm, className: isArmed ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : '', "data-testid": "button-arm", children: [_jsx(Target, { className: "w-4 h-4 mr-1" }), "Arm"] }), _jsxs(Button, { variant: isRecording ? 'destructive' : 'outline', size: "sm", onClick: handleRecord, 
                // Disabled if not armed, or if currently playing (can't record during playback)
                disabled: !isArmed || isPlaying, className: isRecording ? 'animate-pulse' : '', "data-testid": "button-record", children: [_jsx(Circle, { className: `w-4 h-4 mr-1 ${isRecording ? 'fill-current' : ''}` }), "Rec"] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: onStop, "data-testid": "button-stop", children: [_jsx(Square, { className: "w-4 h-4 mr-1 fill-current" }), "Stop"] }), _jsxs(Button, { variant: isPlaying ? 'default' : 'outline', size: "sm", onClick: handlePlay, 
                // Disabled if no events to play, or if currently recording
                disabled: !hasEvents || isRecording, "data-testid": "button-play", children: [_jsx(Play, { className: "w-4 h-4 mr-1 fill-current" }), "Play"] }), _jsx("div", { className: "w-px h-6 bg-border mx-1", "aria-hidden": true }), _jsx(Button, { variant: "ghost", size: "sm", onClick: onUndo, disabled: !hasEvents, "data-testid": "button-undo", children: _jsx(Undo, { className: "w-4 h-4" }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: onRedo, "data-testid": "button-redo", children: _jsx(Redo, { className: "w-4 h-4" }) }), _jsx("div", { className: "w-px h-6 bg-border mx-1", "aria-hidden": true }), _jsxs(Button, { variant: "outline", size: "sm", onClick: onExport, "data-testid": "button-export", children: [_jsx(Download, { className: "w-4 h-4 mr-1" }), "Export"] }), hasEvents && (_jsxs("span", { className: "text-xs text-muted-foreground ml-2", children: [recordedEventsCount, " events"] }))] }));
});
