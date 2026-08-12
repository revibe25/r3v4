import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// @ts-nocheck
// vst-plugin-manager.tsx
import { useState } from 'react';
import { Plus, Trash2, Settings, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
export function VSTPluginManager({ plugins = [], onPluginAdd, onPluginRemove, onPluginToggle, onPluginConfigure, }) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newPlugin, setNewPlugin] = useState({
        name: '',
        path: '',
        type: 'vst3',
        manufacturer: '',
    });
    const handleAddPlugin = () => {
        if (!newPlugin.name || !newPlugin.path) {
            return;
        }
        const plugin = {
            id: `plugin-${Date.now()}`,
            name: newPlugin.name,
            path: newPlugin.path,
            enabled: true,
            type: newPlugin.type,
            manufacturer: newPlugin.manufacturer || undefined,
        };
        onPluginAdd?.(plugin);
        setNewPlugin({ name: '', path: '', type: 'vst3', manufacturer: '' });
        setShowAddForm(false);
    };
    const handleScanPlugins = async () => {
        // Placeholder for VST scanning functionality
        console.log('Scanning for VST plugins...');
        // In a real implementation, this would call a backend API or Electron IPC
        // to scan common VST directories
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold", children: "VST Plugin Manager" }), _jsx("p", { className: "text-sm text-[var(--text-dim)]", children: "Manage your installed VST plugins" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: handleScanPlugins, variant: "outline", size: "sm", children: "Scan for Plugins" }), _jsxs(Button, { onClick: () => setShowAddForm(!showAddForm), variant: "outline", size: "sm", children: [_jsx(Plus, { className: "h-4 w-4 mr-1" }), "Add Plugin"] })] })] }), showAddForm && (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Add VST Plugin" }), _jsx(CardDescription, { children: "Manually add a VST plugin to your library" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "plugin-name", children: "Plugin Name" }), _jsx(Input, { id: "plugin-name", placeholder: "e.g., Reverb Pro", value: newPlugin.name, onChange: (e) => setNewPlugin({ ...newPlugin, name: e.target.value }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "plugin-path", children: "Plugin Path" }), _jsx(Input, { id: "plugin-path", placeholder: "/path/to/plugin.vst3", value: newPlugin.path, onChange: (e) => setNewPlugin({ ...newPlugin, path: e.target.value }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "plugin-manufacturer", children: "Manufacturer (Optional)" }), _jsx(Input, { id: "plugin-manufacturer", placeholder: "e.g., Audio Company", value: newPlugin.manufacturer, onChange: (e) => setNewPlugin({ ...newPlugin, manufacturer: e.target.value }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "plugin-type", children: "Plugin Type" }), _jsxs("select", { id: "plugin-type", className: "w-full px-3 py-2 border rounded-none", value: newPlugin.type, onChange: (e) => setNewPlugin({
                                            ...newPlugin,
                                            type: e.target.value,
                                        }), children: [_jsx("option", { value: "vst3", children: "VST3" }), _jsx("option", { value: "vst2", children: "VST2" }), _jsx("option", { value: "au", children: "Audio Unit (AU)" })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: handleAddPlugin, children: "Add Plugin" }), _jsx(Button, { variant: "outline", onClick: () => setShowAddForm(false), children: "Cancel" })] })] })] })), _jsx("div", { className: "space-y-2", children: plugins.length === 0 ? (_jsx(Card, { children: _jsxs(CardContent, { className: "py-8 text-center text-[var(--text-dim)]", children: [_jsx("p", { children: "No plugins installed" }), _jsx("p", { className: "text-sm mt-1", children: "Click \"Scan for Plugins\" or \"Add Plugin\" to get started" })] }) })) : (plugins.map((plugin) => (_jsx(Card, { children: _jsx(CardContent, { className: "py-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-4 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Switch, { checked: plugin.enabled, onCheckedChange: (checked) => onPluginToggle?.(plugin.id, checked) }), _jsx(Power, { className: `h-4 w-4 ${plugin.enabled
                                                        ? 'text-accent'
                                                        : 'text-[var(--text-dim)]'}` })] }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-medium", children: plugin.name }), _jsxs("div", { className: "text-sm text-[var(--text-dim)]", children: [plugin.manufacturer && (_jsxs("span", { children: [plugin.manufacturer, " \u2022 "] })), _jsx("span", { className: "uppercase", children: plugin.type })] }), _jsx("div", { className: "text-xs text-[var(--text-dim)] mt-1", children: plugin.path })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => onPluginConfigure?.(plugin.id), children: _jsx(Settings, { className: "h-4 w-4" }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => onPluginRemove?.(plugin.id), children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }) }) }, plugin.id)))) })] }));
}
export default VSTPluginManager;
