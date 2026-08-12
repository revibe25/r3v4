import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { VSTScanner } from '@/audio/fx/vst-scanner';
import { Search, Star, TrendingUp, Grid, List, RefreshCw, Package } from 'lucide-react';
import { getAudioContext } from '@/audio/core/audio-context';
import { useVSTStore } from '@/store/vst-store';
// ── Acid Grid design tokens ───────────────────────────────────────────────────
// Mirrors the CSS custom properties in instrument.tsx STYLES block.
const AG = {
    black: 'var(--void)',
    ink: '#0a0a0a',
    panel: '#0d0d0d',
    card: 'var(--t-b1)',
    border: '#1c1c1c',
    mute: '#2a2a2a',
    dim: 'var(--neutral-700)',
    mid: 'var(--dj-muted)',
    soft: 'var(--text-dim)',
    acid: '#a3e635',
    acid2: 'var(--looper-lime)',
    acidDim: 'rgba(163,230,53,0.08)',
    acidD: 'var(--status-ok-dim)',
    white: 'var(--daw-fg)',
    err: '#ff3b3b',
    rec: '#ef4444',
    cyan: 'var(--looper-cyan)',
    font: "'IBM Plex Mono', 'JetBrains Mono', monospace",
};
// Per-category accent colours for badges and active states
const CAT_COLOR = {
    synth: AG.acid,
    instrument: AG.acid,
    effects: AG.cyan,
    effect: AG.cyan,
    dynamics: 'var(--status-warn)',
    eq: 'var(--accent-violet-soft)',
    reverb: 'var(--accent-blue)',
    delay: 'var(--status-ok-alt)',
    distortion: AG.err,
    utility: AG.soft,
    filter: 'var(--orange-400)',
    chorus: 'var(--accent-fuchsia)',
    modulation: 'var(--accent-blue)',
};
const catAccent = (cat = '') => CAT_COLOR[cat.toLowerCase()] ?? AG.soft;
// ── Shared style helpers ──────────────────────────────────────────────────────
const mono = { fontFamily: AG.font };
const tag = {
    ...mono,
    fontSize: 7, letterSpacing: '0.2em',
    textTransform: 'uppercase',
};
// Keyframes injected once
const KEYFRAMES = `
  @keyframes vst-spin  { to { transform: rotate(360deg); } }
  @keyframes vst-sweep { from { left: -60%; } to { left: 100%; } }
  @keyframes vst-pulse { from { opacity: 0.5; } to { opacity: 1; } }
`;
// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function VSTBrowser({ onPluginSelect, channelId }) {
    const addPluginToChannel = useVSTStore(s => s.addPluginToChannel);
    const [plugins, setPlugins] = useState([]);
    const [recentIds, setRecentIds] = useState([]);
    const [loadingId, setLoadingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCat, setSelectedCat] = useState('all');
    const [viewMode, setViewMode] = useState('grid');
    const [isScanning, setIsScanning] = useState(false);
    const [scanMsg, setScanMsg] = useState('');
    // Load cached plugins on mount
    useEffect(() => {
        VSTScanner.loadFromStorage();
        setPlugins(VSTScanner.getAllCachedPlugins());
    }, []);
    // ── Scan ─────────────────────────────────────────────────────────────────
    const handleScan = useCallback(async () => {
        setIsScanning(true);
        setScanMsg('INITIALIZING SCANNER...');
        try {
            const audioCtx = getAudioContext();
            setScanMsg('SCANNING /PLUGINS...');
            const result = await VSTScanner.scanDirectory('/plugins', audioCtx);
            setPlugins(result.plugins);
            VSTScanner.saveToStorage();
            setScanMsg(`FOUND ${result.plugins.length} PLUGIN${result.plugins.length !== 1 ? 'S' : ''}`);
            setTimeout(() => setScanMsg(''), 2500);
        }
        catch (err) {
            setScanMsg('SCAN FAILED');
            setTimeout(() => setScanMsg(''), 2500);
            console.error('VSTBrowser scan error:', err);
        }
        finally {
            setIsScanning(false);
        }
    }, []);
    // ── Select ───────────────────────────────────────────────────────────────
    const handlePluginSelect = useCallback((plugin) => {
        setLoadingId(plugin.id);
        setRecentIds(prev => [plugin.id, ...prev.filter(id => id !== plugin.id)].slice(0, 10));
        if (channelId)
            addPluginToChannel(channelId, plugin.id, plugin.name);
        onPluginSelect(plugin);
        setTimeout(() => setLoadingId(null), 600);
    }, [channelId, addPluginToChannel, onPluginSelect]);
    // ── Favorite toggle ───────────────────────────────────────────────────────
    const toggleFavorite = useCallback((pluginId, e) => {
        e.stopPropagation();
        setPlugins(prev => prev.map(p => p.id === pluginId ? { ...p, isFavorite: !p.isFavorite } : p));
        VSTScanner.saveToStorage();
    }, []);
    // ── Derived data ──────────────────────────────────────────────────────────
    const categories = useMemo(() => Array.from(new Set(plugins.map(p => p.category))).sort(), [plugins]);
    const filteredPlugins = useMemo(() => {
        return plugins.filter(plugin => {
            if (selectedCat === 'favorites')
                return !!plugin.isFavorite;
            if (selectedCat === 'recent')
                return recentIds.includes(plugin.id);
            if (selectedCat !== 'all' && plugin.category !== selectedCat)
                return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return (plugin.name.toLowerCase().includes(q) ||
                    plugin.vendor.toLowerCase().includes(q) ||
                    plugin.tags.some(t => t.toLowerCase().includes(q)));
            }
            return true;
        });
    }, [plugins, searchQuery, selectedCat, recentIds]);
    const TABS = [
        { id: 'all', label: 'ALL', icon: null, accent: AG.white },
        { id: 'favorites', label: 'FAV', icon: _jsx(Star, { size: 9 }), accent: 'var(--status-warn)' },
        { id: 'recent', label: 'RECENT', icon: _jsx(TrendingUp, { size: 9 }), accent: AG.cyan },
        ...categories.map(c => ({ id: c, label: c.toUpperCase(), icon: null, accent: catAccent(c) })),
    ];
    // ── Render ────────────────────────────────────────────────────────────────
    return (_jsxs("div", { style: {
            display: 'flex', flexDirection: 'column',
            background: AG.panel, fontFamily: AG.font,
            minHeight: 0, height: '100%',
        }, children: [_jsx("style", { children: KEYFRAMES }), _jsxs("div", { style: {
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px',
                    background: AG.ink,
                    borderBottom: `1px solid ${AG.border}`,
                    flexShrink: 0,
                }, children: [_jsxs("div", { style: { position: 'relative', flex: 1, minWidth: 0 }, children: [_jsx(Search, { size: 10, style: {
                                    position: 'absolute', left: 10, top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: AG.mid, pointerEvents: 'none',
                                } }), _jsx("input", { type: "text", value: searchQuery, onChange: e => setSearchQuery(e.target.value), placeholder: "SEARCH PLUGINS...", style: {
                                    ...mono,
                                    width: '100%', boxSizing: 'border-box',
                                    background: AG.black,
                                    border: `1px solid ${AG.border}`,
                                    borderRadius: 0,
                                    color: AG.white,
                                    fontSize: 9, letterSpacing: '0.15em',
                                    padding: '6px 10px 6px 28px',
                                    outline: 'none',
                                    transition: 'border-color 0.1s, box-shadow 0.1s',
                                }, onFocus: e => {
                                    e.currentTarget.style.borderColor = AG.acid;
                                    e.currentTarget.style.boxShadow = `0 0 0 1px ${AG.acid}`;
                                }, onBlur: e => {
                                    e.currentTarget.style.borderColor = AG.border;
                                    e.currentTarget.style.boxShadow = 'none';
                                } })] }), ['grid', 'list'].map(mode => {
                        const active = viewMode === mode;
                        return (_jsx("button", { onClick: () => setViewMode(mode), title: `${mode} view`, style: {
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 28, height: 28, padding: 0, flexShrink: 0,
                                background: active ? AG.acidDim : 'transparent',
                                border: `1px solid ${active ? AG.acid : AG.border}`,
                                color: active ? AG.acid : AG.mid,
                                cursor: 'pointer',
                                boxShadow: active ? `0 0 8px ${AG.acid}33` : 'none',
                                transition: 'all 0.1s',
                            }, onMouseEnter: e => {
                                if (!active) {
                                    e.currentTarget.style.borderColor = AG.dim;
                                    e.currentTarget.style.color = AG.soft;
                                }
                            }, onMouseLeave: e => {
                                if (!active) {
                                    e.currentTarget.style.borderColor = AG.border;
                                    e.currentTarget.style.color = AG.mid;
                                }
                            }, children: mode === 'grid' ? _jsx(Grid, { size: 11 }) : _jsx(List, { size: 11 }) }, mode));
                    }), _jsxs("button", { onClick: handleScan, disabled: isScanning, style: {
                            ...mono,
                            display: 'flex', alignItems: 'center', gap: 6,
                            height: 28, padding: '0 12px', flexShrink: 0,
                            background: isScanning ? AG.acidDim : 'transparent',
                            border: `1px solid ${isScanning ? AG.acid : AG.border}`,
                            color: isScanning ? AG.acid : AG.mid,
                            cursor: isScanning ? 'default' : 'pointer',
                            fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.1s',
                        }, onMouseEnter: e => {
                            if (!isScanning) {
                                e.currentTarget.style.borderColor = AG.acid;
                                e.currentTarget.style.color = AG.acid;
                            }
                        }, onMouseLeave: e => {
                            if (!isScanning) {
                                e.currentTarget.style.borderColor = AG.border;
                                e.currentTarget.style.color = AG.mid;
                            }
                        }, children: [_jsx(RefreshCw, { size: 10, style: { animation: isScanning ? 'vst-spin 1s linear infinite' : 'none' } }), isScanning ? 'SCANNING' : 'SCAN'] })] }), isScanning && (_jsx("div", { style: {
                    height: 2, background: AG.border,
                    position: 'relative', overflow: 'hidden', flexShrink: 0,
                }, children: _jsx("div", { style: {
                        position: 'absolute', left: '-60%', top: 0, bottom: 0, width: '60%',
                        background: `linear-gradient(90deg, transparent, ${AG.acid}, transparent)`,
                        animation: 'vst-sweep 1.2s linear infinite',
                    } }) })), scanMsg && (_jsx("div", { style: {
                    ...tag, color: isScanning ? AG.acid : AG.soft,
                    padding: '4px 14px',
                    background: AG.ink, borderBottom: `1px solid ${AG.border}`,
                    flexShrink: 0,
                }, children: scanMsg })), _jsx("div", { style: {
                    display: 'flex', alignItems: 'center', gap: 2,
                    overflowX: 'auto', flexShrink: 0,
                    padding: '6px 14px',
                    background: AG.black,
                    borderBottom: `1px solid ${AG.border}`,
                    // hide scrollbar
                    scrollbarWidth: 'none',
                }, children: TABS.map(({ id, label, icon, accent }) => {
                    const active = selectedCat === id;
                    return (_jsxs("button", { onClick: () => setSelectedCat(id), style: {
                            ...mono,
                            display: 'flex', alignItems: 'center', gap: 5,
                            height: 24, padding: '0 10px', flexShrink: 0,
                            background: active ? `${accent}18` : 'transparent',
                            border: `1px solid ${active ? accent : AG.border}`,
                            color: active ? accent : AG.mid,
                            fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
                            cursor: 'pointer',
                            boxShadow: active ? `0 0 8px ${accent}33` : 'none',
                            transition: 'all 0.1s',
                            whiteSpace: 'nowrap',
                        }, onMouseEnter: e => {
                            if (!active) {
                                e.currentTarget.style.color = AG.soft;
                                e.currentTarget.style.borderColor = AG.mute;
                            }
                        }, onMouseLeave: e => {
                            if (!active) {
                                e.currentTarget.style.color = AG.mid;
                                e.currentTarget.style.borderColor = AG.border;
                            }
                        }, children: [icon, label] }, id));
                }) }), _jsxs("div", { style: {
                    flex: 1, overflowY: 'auto', minHeight: 0,
                    padding: viewMode === 'grid' ? '12px 14px 6px' : 0,
                    scrollbarWidth: 'thin',
                    scrollbarColor: `${AG.acidD} ${AG.ink}`,
                }, children: [filteredPlugins.length === 0 && (_jsxs("div", { style: {
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            gap: 14, padding: '40px 20px',
                        }, children: [_jsx(Package, { size: 28, color: AG.dim }), _jsx("div", { style: { ...tag, color: AG.mid, textAlign: 'center', fontSize: 9 }, children: searchQuery
                                    ? 'NO PLUGINS MATCH SEARCH'
                                    : plugins.length === 0
                                        ? 'NO PLUGINS LOADED — CLICK SCAN'
                                        : 'EMPTY FOR THIS FILTER' }), plugins.length === 0 && !searchQuery && (_jsx("div", { style: {
                                    ...mono, fontSize: 8, color: AG.dim,
                                    textAlign: 'center', lineHeight: 2,
                                    maxWidth: 240,
                                }, children: "Place .vst3 / .vst files in /plugins then press SCAN" }))] })), viewMode === 'grid' && filteredPlugins.length > 0 && (_jsx("div", { style: {
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(158px, 1fr))',
                            gap: 5,
                        }, children: filteredPlugins.map(plugin => (_jsx(PluginCard, { plugin: plugin, loading: loadingId === plugin.id, onSelect: () => handlePluginSelect(plugin), onToggleFavorite: e => toggleFavorite(plugin.id, e) }, plugin.id))) })), viewMode === 'list' && filteredPlugins.length > 0 && (_jsxs("div", { children: [_jsx("div", { style: {
                                    display: 'grid',
                                    gridTemplateColumns: '88px 1fr 110px 70px 28px',
                                    gap: 0,
                                    padding: '5px 14px',
                                    background: AG.black,
                                    borderBottom: `1px solid ${AG.border}`,
                                    position: 'sticky', top: 0, zIndex: 1,
                                }, children: ['CAT', 'NAME', 'VENDOR', 'VER', '★'].map(h => (_jsx("div", { style: { ...tag, color: AG.dim, fontSize: 8 }, children: h }, h))) }), filteredPlugins.map(plugin => (_jsx(PluginListItem, { plugin: plugin, loading: loadingId === plugin.id, onSelect: () => handlePluginSelect(plugin), onToggleFavorite: e => toggleFavorite(plugin.id, e) }, plugin.id)))] })), filteredPlugins.length > 0 && (_jsxs("div", { style: {
                            ...tag, fontSize: 8, color: AG.dim, textAlign: 'right',
                            padding: viewMode === 'grid' ? '8px 0 2px' : '6px 14px',
                        }, children: [filteredPlugins.length, " PLUGIN", filteredPlugins.length !== 1 ? 'S' : '', searchQuery && ` — "${searchQuery.toUpperCase()}"`] }))] })] }));
}
// ─────────────────────────────────────────────────────────────────────────────
// PLUGIN CARD — grid view
// ─────────────────────────────────────────────────────────────────────────────
function PluginCard({ plugin, loading, onSelect, onToggleFavorite, }) {
    const [hovered, setHovered] = useState(false);
    const accent = catAccent(plugin.category);
    return (_jsxs("div", { onClick: loading ? undefined : onSelect, onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false), style: {
            position: 'relative',
            background: hovered ? 'var(--dj-surface2)' : AG.card,
            border: `1px solid ${hovered ? AG.dim : AG.border}`,
            borderTop: `2px solid ${hovered ? accent : AG.border}`,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.55 : 1,
            transition: 'background 0.1s, border-color 0.1s',
            padding: '10px 10px 9px',
            display: 'flex', flexDirection: 'column', gap: 7,
            animation: loading ? 'vst-pulse 0.5s ease infinite alternate' : 'none',
            boxShadow: hovered ? `inset 0 0 20px rgba(0,0,0,0.4)` : 'none',
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }, children: [_jsx("span", { style: {
                            ...tag, fontSize: 7,
                            color: accent,
                            background: `${accent}14`,
                            border: `1px solid ${accent}40`,
                            padding: '2px 5px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            maxWidth: '72%',
                        }, children: plugin.category || 'VST' }), _jsx("button", { onClick: onToggleFavorite, style: {
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: 2, flexShrink: 0,
                            color: plugin.isFavorite ? 'var(--status-warn)' : AG.dim,
                            transition: 'color 0.1s',
                            display: 'flex', alignItems: 'center',
                        }, onMouseEnter: e => { e.currentTarget.style.color = 'var(--status-warn)'; }, onMouseLeave: e => { e.currentTarget.style.color = plugin.isFavorite ? 'var(--status-warn)' : AG.dim; }, children: _jsx(Star, { size: 10, style: { fill: plugin.isFavorite ? 'var(--status-warn)' : 'none' } }) })] }), _jsx("div", { style: {
                    fontFamily: AG.font, fontWeight: 600, fontSize: 11,
                    color: hovered ? AG.white : 'var(--text-secondary)',
                    letterSpacing: '0.02em', lineHeight: 1.2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }, children: plugin.name }), _jsx("div", { style: {
                    fontFamily: AG.font, fontSize: 8, color: AG.soft,
                    letterSpacing: '0.08em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }, children: plugin.vendor }), plugin.tags.length > 0 && (_jsx("div", { style: { display: 'flex', gap: 3, flexWrap: 'wrap' }, children: plugin.tags.slice(0, 2).map(t => (_jsx("span", { style: {
                        ...tag, fontSize: 7, color: AG.mid,
                        border: `1px solid ${AG.border}`,
                        padding: '1px 4px',
                    }, children: t }, t))) })), hovered && (_jsx("div", { style: {
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
                    background: accent,
                    boxShadow: `0 0 6px ${accent}`,
                    pointerEvents: 'none',
                } }))] }));
}
// ─────────────────────────────────────────────────────────────────────────────
// PLUGIN LIST ITEM — list view
// ─────────────────────────────────────────────────────────────────────────────
function PluginListItem({ plugin, loading, onSelect, onToggleFavorite, }) {
    const [hovered, setHovered] = useState(false);
    const accent = catAccent(plugin.category);
    return (_jsxs("div", { onClick: loading ? undefined : onSelect, onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false), style: {
            display: 'grid',
            gridTemplateColumns: '88px 1fr 110px 70px 28px',
            alignItems: 'center',
            gap: 0,
            padding: '0 14px',
            height: 38,
            background: hovered ? 'var(--t-b1)' : 'transparent',
            borderBottom: `1px solid ${AG.border}`,
            borderLeft: `3px solid ${hovered ? accent : 'transparent'}`,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.55 : 1,
            transition: 'background 0.08s, border-left-color 0.08s',
            animation: loading ? 'vst-pulse 0.5s ease infinite alternate' : 'none',
        }, children: [_jsx("span", { style: {
                    ...tag, fontSize: 7, color: accent,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    paddingRight: 8,
                }, children: plugin.category || '—' }), _jsx("span", { style: {
                    fontFamily: AG.font, fontWeight: 600, fontSize: 10,
                    color: hovered ? AG.white : 'var(--daw-ghost)',
                    letterSpacing: '0.04em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    paddingRight: 8,
                }, children: plugin.name }), _jsx("span", { style: {
                    fontFamily: AG.font, fontSize: 9, color: AG.soft,
                    letterSpacing: '0.06em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    paddingRight: 8,
                }, children: plugin.vendor }), _jsx("span", { style: {
                    fontFamily: AG.font, fontSize: 8, color: AG.dim, letterSpacing: '0.1em',
                }, children: plugin.version ? `v${plugin.version}` : '—' }), _jsx("button", { onClick: onToggleFavorite, style: {
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: plugin.isFavorite ? 'var(--status-warn)' : AG.dim,
                    transition: 'color 0.1s',
                }, onMouseEnter: e => { e.stopPropagation(); e.currentTarget.style.color = 'var(--status-warn)'; }, onMouseLeave: e => { e.currentTarget.style.color = plugin.isFavorite ? 'var(--status-warn)' : AG.dim; }, children: _jsx(Star, { size: 10, style: { fill: plugin.isFavorite ? 'var(--status-warn)' : 'none' } }) })] }));
}
