// client/src/components/vst-browser.tsx

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VSTScanner, VSTPluginInfo } from '@/audio/fx/vst-scanner';
import { Search, Star, TrendingUp, Grid, List, RefreshCw } from 'lucide-react';
import { getAudioContext } from '@/audio/core/audio-context';
import { useVSTStore }     from '@/store/vst-store';

interface VSTBrowserProps {
  onPluginSelect: (plugin: VSTPluginInfo) => void;
  channelId?:    string;   // auto-insert plugin into this channel when selected
  showFXChain?:  boolean;
}

export function VSTBrowser({ onPluginSelect, channelId, showFXChain }: VSTBrowserProps) {
  const addPluginToChannel = useVSTStore(s => s.addPluginToChannel);
  const [plugins,   setPlugins]   = useState<VSTPluginInfo[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    // Load cached plugins on mount
    VSTScanner.loadFromStorage();
    setPlugins(VSTScanner.getAllCachedPlugins());
  }, []);

  const handleScan = async () => {
    setIsScanning(true);
    setScanProgress(0);

    try {
      const audioCtx = getAudioContext();
      const result = await VSTScanner.scanDirectory('/plugins', audioCtx);
      
      setPlugins(result.plugins);
      VSTScanner.saveToStorage();

      if (result.errors.length > 0) {
        console.warn('Scan completed with errors:', result.errors);
      }
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setIsScanning(false);
      setScanProgress(100);
    }
  };

  const handlePluginSelect = (plugin: VSTPluginInfo) => {
    setLoadingId(plugin.id);
    setRecentIds(prev => [plugin.id, ...prev.filter(id => id !== plugin.id)].slice(0, 10));
    if (channelId) addPluginToChannel(channelId, plugin.id, plugin.name);
    onPluginSelect(plugin);
    setTimeout(() => setLoadingId(null), 600);
  };

  const filteredPlugins = useMemo(() => {
    return plugins.filter(plugin => {
      // Special tabs first
      if (selectedCategory === 'favorites') return !!plugin.isFavorite;
      if (selectedCategory === 'recent')    return recentIds.includes(plugin.id);

      // Category filter
      if (selectedCategory !== 'all' && plugin.category !== selectedCategory) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          plugin.name.toLowerCase().includes(query) ||
          plugin.vendor.toLowerCase().includes(query) ||
          plugin.tags.some(tag => tag.includes(query))
        );
      }
      return true;
    });
  }, [plugins, searchQuery, selectedCategory, recentIds]);

  const categories = useMemo(() => {
    const cats = new Set(plugins.map(p => p.category));
    return Array.from(cats);
  }, [plugins]);

  const toggleFavorite = (pluginId: string) => {
    setPlugins(prev =>
      prev.map(p =>
        p.id === pluginId ? { ...p, isFavorite: !p.isFavorite } : p
      )
    );
    VSTScanner.saveToStorage();
  };

  return (
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>VST Plugin Browser</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            >
              {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleScan}
              disabled={isScanning}
            >
              <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
              {isScanning ? 'Scanning...' : 'Scan'}
            </Button>
          </div>
        </CardTitle>

        <div className="flex gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-[#888]" />
            <Input
              placeholder="Search plugins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="favorites">
              <Star className="h-4 w-4 mr-1" />
              Favorites
            </TabsTrigger>
            <TabsTrigger value="recent">
              <TrendingUp className="h-4 w-4 mr-1" />
              Recent
            </TabsTrigger>
            {categories.map(cat => (
              <TabsTrigger key={cat} value={cat}>
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedCategory} className="mt-4">
            <ScrollArea className="h-[500px]">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredPlugins.map(plugin => (
                    <PluginCard
                      key={plugin.id}
                      plugin={plugin}
                      onSelect={() => handlePluginSelect(plugin)}
                      loading={loadingId === plugin.id}
                      onToggleFavorite={() => toggleFavorite(plugin.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPlugins.map(plugin => (
                    <PluginListItem
                      key={plugin.id}
                      plugin={plugin}
                      onSelect={() => handlePluginSelect(plugin)}
                      loading={loadingId === plugin.id}
                      onToggleFavorite={() => toggleFavorite(plugin.id)}
                    />
                  ))}
                </div>
              )}

              {filteredPlugins.length === 0 && (
                <div className="text-center py-12 text-[#888]">
                  {searchQuery ? 'No plugins found' : 'No plugins available. Click Scan to load plugins.'}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function PluginCard({
  plugin,
  onSelect,
  onToggleFavorite,
  loading,
}: {
  plugin: VSTPluginInfo;
  onSelect: () => void;
  onToggleFavorite: () => void;
  loading?: boolean;
}) {
  return (
    <Card
      className={`cursor-pointer hover:bg-accent transition-colors${loading ? ' opacity-60 pointer-events-none' : ''}`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <Badge variant="secondary">{plugin.category}</Badge>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="text-yellow-500 hover:text-yellow-600"
          >
            <Star className={`h-4 w-4 ${plugin.isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>

        <h3 className="font-semibold truncate">{plugin.name}</h3>
        <p className="text-sm text-[#888] truncate">{plugin.vendor}</p>

        <div className="flex flex-wrap gap-1 mt-2">
          {plugin.tags.slice(0, 2).map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PluginListItem({
  plugin,
  onSelect,
  onToggleFavorite,
  loading,
}: {
  plugin: VSTPluginInfo;
  onSelect: () => void;
  onToggleFavorite: () => void;
  loading?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between p-3 border rounded-none hover:bg-accent cursor-pointer${loading ? ' opacity-60 pointer-events-none' : ''}`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-4 flex-1">
        <Badge variant="secondary">{plugin.category}</Badge>
        <div className="flex-1">
          <h4 className="font-medium">{plugin.name}</h4>
          <p className="text-sm text-[#888]">
            {plugin.vendor} • v{plugin.version}
          </p>
        </div>
        <div className="flex gap-1">
          {plugin.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="text-yellow-500 hover:text-yellow-600"
      >
        <Star className={`h-4 w-4 ${plugin.isFavorite ? 'fill-current' : ''}`} />
      </button>
    </div>
  );
}