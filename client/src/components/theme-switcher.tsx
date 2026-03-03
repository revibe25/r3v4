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

// Enhanced theme configurations with beautiful icons and descriptions
const THEME_CONFIGS = {
  light: {
    icon: Sun,
    label: 'Light',
    gradient: 'from-amber-200 via-orange-200 to-yellow-200',
    bgGradient: 'from-gray-50 to-white',
    shadow: 'shadow-amber-500/20',
    description: 'Clean and bright',
    accent: '#f59e0b',
    comfort: 'Day Mode',
  },
  dark: {
    icon: Moon,
    label: 'Dark',
    gradient: 'from-slate-700 via-slate-800 to-slate-900',
    bgGradient: 'from-slate-950 to-slate-900',
    shadow: 'shadow-blue-500/20',
    description: 'Easy on the eyes',
    accent: '#3b82f6',
    comfort: 'Night Mode',
  },
  chrome: {
    icon: Monitor,
    label: 'Chrome',
    gradient: 'from-gray-300 via-slate-400 to-gray-500',
    bgGradient: 'from-slate-900 to-gray-900',
    shadow: 'shadow-slate-400/30',
    description: 'Polished metal finish',
    accent: '#c5c9cc',
    comfort: 'Metallic',
  },
  steel: {
    icon: Mountain,
    label: 'Steel',
    gradient: 'from-slate-400 via-slate-500 to-slate-600',
    bgGradient: 'from-slate-950 to-slate-900',
    shadow: 'shadow-slate-500/20',
    description: 'Industrial strength',
    accent: '#8b95a1',
    comfort: 'Industrial',
  },
  forest: {
    icon: Leaf,
    label: 'Forest',
    gradient: 'from-green-500 via-emerald-500 to-teal-600',
    bgGradient: 'from-emerald-950 to-green-950',
    shadow: 'shadow-emerald-500/20',
    description: 'Natural and soothing',
    accent: '#10b981',
    comfort: 'Nature',
  },
  sunset: {
    icon: Flame,
    label: 'Sunset',
    gradient: 'from-orange-500 via-red-500 to-pink-600',
    bgGradient: 'from-orange-950 to-red-950',
    shadow: 'shadow-orange-500/20',
    description: 'Warm and cozy',
    accent: '#f97316',
    comfort: 'Warm',
  },
  midnight: {
    icon: Moon,
    label: 'Midnight',
    gradient: 'from-indigo-600 via-purple-700 to-slate-900',
    bgGradient: 'from-slate-950 to-indigo-950',
    shadow: 'shadow-indigo-500/20',
    description: 'Ultra dark, minimal eye strain',
    accent: '#4f46e5',
    comfort: 'Ultra Dark',
  },
  aurora: {
    icon: Sparkles,
    label: 'Aurora',
    gradient: 'from-violet-500 via-fuchsia-500 to-pink-500',
    bgGradient: 'from-violet-950 to-fuchsia-950',
    shadow: 'shadow-fuchsia-500/25',
    description: 'Magical and dreamy',
    accent: '#d946ef',
    comfort: 'Dreamy',
  },
  bronze: {
    icon: Flame,
    label: 'Bronze',
    gradient: 'from-amber-600 via-orange-700 to-yellow-800',
    bgGradient: 'from-amber-950 to-orange-950',
    shadow: 'shadow-amber-600/25',
    description: 'Warm patina metal',
    accent: '#cd7f32',
    comfort: 'Warm Metal',
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
                    <Icon className="w-5 h-5 text-white drop-shadow-md" />
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
