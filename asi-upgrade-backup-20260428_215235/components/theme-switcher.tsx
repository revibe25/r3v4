// @ts-nocheck
// client/src/components/theme-switcher.tsx

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
  Palette,
  Moon,
  Sun,
  Monitor,
  Zap,
  Sparkles,
  Eye,
  Droplets,
  Flame,
  Leaf,
  Mountain,
  Waves,
  Check,
  CircleDot,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

interface ThemeSwitcherProps {
  compact?: boolean;
  showLabel?: boolean;
  animated?: boolean;
}

// Theme configurations — acid techno DAW palette
// Colors: deep blacks, industrial metals, neon accents. No pastels.
const THEME_CONFIGS = {
  light: {
    icon: Sun,
    label: 'Light',
    gradient: 'from-zinc-300 via-slate-400 to-zinc-500',
    bgGradient: 'from-zinc-200 to-slate-300',
    shadow: 'shadow-zinc-400/30',
    description: 'Brushed aluminum daylight',
    accent: '#f59e0b',
    comfort: 'Daylight',
  },
  dark: {
    icon: Moon,
    label: 'Dark',
    gradient: 'from-zinc-700 via-slate-800 to-zinc-900',
    bgGradient: 'from-zinc-950 to-slate-950',
    shadow: 'shadow-blue-500/20',
    description: 'Studio void black',
    accent: '#3b82f6',
    comfort: 'Studio',
  },
  chrome: {
    icon: Monitor,
    label: 'Chrome',
    gradient: 'from-zinc-400 via-slate-500 to-zinc-600',
    bgGradient: 'from-zinc-900 to-slate-900',
    shadow: 'shadow-zinc-400/30',
    description: 'Polished chrome plate',
    accent: '#c5c9cc',
    comfort: 'Chrome',
  },
  steel: {
    icon: Mountain,
    label: 'Steel',
    gradient: 'from-slate-500 via-slate-600 to-slate-700',
    bgGradient: 'from-slate-950 to-zinc-950',
    shadow: 'shadow-slate-500/20',
    description: 'Cold-rolled steel',
    accent: '#8b95a1',
    comfort: 'Industrial',
  },
  forest: {
    icon: Leaf,
    label: 'Forest',
    gradient: 'from-emerald-700 via-green-800 to-emerald-900',
    bgGradient: 'from-emerald-950 to-green-950',
    shadow: 'shadow-emerald-700/25',
    description: 'Deep forest canopy',
    accent: '#10b981',
    comfort: 'Organic',
  },
  sunset: {
    icon: Flame,
    label: 'Sunset',
    gradient: 'from-orange-700 via-red-800 to-rose-900',
    bgGradient: 'from-orange-950 to-red-950',
    shadow: 'shadow-orange-700/25',
    description: 'Burning horizon',
    accent: '#f97316',
    comfort: 'Warm',
  },
  midnight: {
    icon: Zap,
    label: 'Midnight',
    gradient: 'from-indigo-800 via-slate-900 to-indigo-950',
    bgGradient: 'from-slate-950 to-indigo-950',
    shadow: 'shadow-indigo-700/20',
    description: 'Deep midnight session',
    accent: '#4f46e5',
    comfort: 'Ultra Dark',
  },
  aurora: {
    icon: Sparkles,
    label: 'Aurora',
    gradient: 'from-violet-700 via-fuchsia-800 to-pink-800',
    bgGradient: 'from-violet-950 to-fuchsia-950',
    shadow: 'shadow-fuchsia-700/25',
    description: 'Northern lights',
    accent: '#d946ef',
    comfort: 'Atmospheric',
  },
  bronze: {
    icon: Flame,
    label: 'Bronze',
    gradient: 'from-amber-700 via-orange-800 to-amber-900',
    bgGradient: 'from-amber-950 to-orange-950',
    shadow: 'shadow-amber-700/25',
    description: 'Oxidized bronze patina',
    accent: '#cd7f32',
    comfort: 'Warm Metal',
  },
  copper: {
    icon: Droplets,
    label: 'Copper',
    gradient: 'from-orange-600 via-amber-700 to-orange-800',
    bgGradient: 'from-orange-950 to-amber-950',
    shadow: 'shadow-orange-600/25',
    description: 'Warm copper plate',
    accent: '#b87333',
    comfort: 'Copper',
  },
  gold: {
    icon: CircleDot,
    label: 'Gold',
    gradient: 'from-yellow-600 via-amber-700 to-yellow-800',
    bgGradient: 'from-yellow-950 to-amber-950',
    shadow: 'shadow-yellow-600/25',
    description: 'Hammered gold leaf',
    accent: '#d4af37',
    comfort: 'Premium',
  },
} as const;

export function ThemeSwitcher({ 
  compact = false, 
  showLabel = false,
  animated = true 
}: ThemeSwitcherProps) {
  const { theme, resolvedTheme, setTheme, themes, themeMetadata } = useTheme();
  const [isChanging, setIsChanging] = useState(false);
  const [hoverTheme, setHoverTheme] = useState<string | null>(null);

  const currentThemeKey = (theme === 'dark' ? resolvedTheme : theme) as keyof typeof THEME_CONFIGS;
  const currentConfig = THEME_CONFIGS[currentThemeKey] || THEME_CONFIGS.dark;
  const CurrentIcon = currentConfig.icon;

  useEffect(() => {
    if (isChanging) {
      const timer = setTimeout(() => setIsChanging(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isChanging]);

  const handleThemeChange = (newTheme: string) => {
    setIsChanging(true);
    setTheme(newTheme);
  };

  /* ------------------------------------------------------------
     COMPACT MODE: Elegant cycling button
     ------------------------------------------------------------ */
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                'relative overflow-hidden group transition-all duration-300',
                animated && 'hover:scale-105 active:scale-95',
                `hover:${currentConfig.shadow}`,
                isChanging && 'animate-pulse'
              )}
              onClick={() => {
                const selectable = themes.filter(t => t !== 'dark');
                const current = theme === 'dark' ? resolvedTheme : theme;
                const index = selectable.indexOf(current);
                const next = selectable[(index + 1) % selectable.length];
                handleThemeChange(next);
              }}
            >
              {/* Gradient background */}
              <div 
                className={cn(
                  'absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300',
                  `bg-gradient-to-br ${currentConfig.gradient}`
                )}
              />
              
              {/* Icon */}
              <CurrentIcon 
                className={cn(
                  'h-4 w-4 relative z-10 transition-transform duration-300',
                  animated && 'group-hover:rotate-12'
                )} 
              />
              
              {/* Animated ring */}
              {animated && (
                <div className="absolute inset-0 rounded-md border-2 border-transparent group-hover:border-current opacity-0 group-hover:opacity-30 transition-all duration-300 animate-pulse" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full', `bg-gradient-to-r ${currentConfig.gradient}`)} />
            <div>
              <p className="font-semibold">{currentConfig.label}</p>
              <p className="text-xs text-muted-foreground">{currentConfig.description}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  /* ------------------------------------------------------------
     FULL DROPDOWN MODE: Beautiful theme gallery
     ------------------------------------------------------------ */
  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size={showLabel ? 'default' : 'icon'}
                className={cn(
                  'relative overflow-hidden group transition-all duration-300',
                  animated && 'hover:scale-105',
                  `hover:${currentConfig.shadow}`
                )}
              >
                {/* Background gradient */}
                <div 
                  className={cn(
                    'absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300',
                    `bg-gradient-to-br ${currentConfig.gradient}`
                  )}
                />
                
                <CurrentIcon className={cn(
                  'h-5 w-5 relative z-10 transition-transform duration-300',
                  animated && 'group-hover:rotate-12',
                  showLabel && 'mr-2'
                )} />
                
                {showLabel && (
                  <span className="relative z-10 font-medium">
                    {currentConfig.label}
                  </span>
                )}
                
                <span className="sr-only">Select theme</span>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Change theme • Current: {currentConfig.label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenuContent 
        align="end" 
        className="w-80 p-2 backdrop-blur-xl bg-background/95"
        sideOffset={8}
      >
        <DropdownMenuLabel className="flex items-center gap-2 pb-2">
          <Eye className="w-4 h-4" />
          <span>Choose Theme</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {Object.keys(THEME_CONFIGS).length} themes
          </Badge>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />

        <div className="py-2 space-y-1">
          {Object.entries(THEME_CONFIGS).map(([key, config]) => {
            const Icon = config.icon;
            const isActive = 
              (key === 'dark' && theme === 'dark') ||
              (key !== 'dark' && resolvedTheme === key);
            const isHovered = hoverTheme === key;

            return (
              <DropdownMenuItem
                key={key}
                onSelect={(e) => {
                  e.preventDefault();
                  handleThemeChange(key);
                }}
                onMouseEnter={() => setHoverTheme(key)}
                onMouseLeave={() => setHoverTheme(null)}
                className={cn(
                  'relative group cursor-pointer rounded-lg p-3 transition-all duration-200',
                  'hover:bg-accent/50',
                  isActive && 'bg-accent/30 ring-2 ring-primary/20',
                  animated && 'hover:scale-[1.02] active:scale-[0.98]'
                )}
              >
                {/* Gradient background on hover */}
                <div 
                  className={cn(
                    'absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300',
                    `bg-gradient-to-br ${config.gradient}`,
                    isHovered && 'opacity-10'
                  )}
                />

                <div className="relative flex items-center gap-3">
                  {/* Theme icon with gradient background */}
                  <div className={cn(
                    'relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300',
                    `bg-gradient-to-br ${config.gradient}`,
                    isHovered && 'scale-110 shadow-lg',
                    config.shadow
                  )}>
                    <Icon className="w-5 h-5 text-foreground drop-shadow-md" />
                  </div>

                  {/* Theme info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{config.label}</span>
                      {isActive && (
                        <Check className="w-4 h-4 text-primary animate-in fade-in zoom-in duration-200" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">
                        {config.description}
                      </p>
                    </div>
                  </div>

                  {/* Comfort badge */}
                  <Badge 
                    variant="outline" 
                    className={cn(
                      'text-xs transition-all duration-200',
                      isHovered && 'bg-accent'
                    )}
                  >
                    {config.comfort}
                  </Badge>
                </div>

                {/* Active indicator line */}
                {isActive && (
                  <div 
                    className={cn(
                      'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full',
                      `bg-gradient-to-b ${config.gradient}`
                    )}
                  />
                )}
              </DropdownMenuItem>
            );
          })}
        </div>

        <DropdownMenuSeparator />

        {/* Eye comfort info */}
        <div className="p-3 mt-2 rounded-lg bg-muted/50">
          <div className="flex items-start gap-2">
            <Eye className="w-4 h-4 mt-0.5 text-muted-foreground" />
            <div className="flex-1 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Eye Comfort Tips</p>
              <ul className="space-y-1">
                <li>• Dark themes reduce eye strain in low light</li>
                <li>• Use System theme to auto-adjust</li>
                <li>• Take breaks every 20 minutes</li>
              </ul>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ThemeSwitcher;
