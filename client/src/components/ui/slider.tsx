import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  showValue?: boolean
  valueDisplay?: (value: number) => string
  vertical?: boolean
  knobSize?: 'sm' | 'md' | 'lg'
  ledIndicator?: boolean
}

const _Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ 
  className, 
  showValue, 
  valueDisplay, 
  vertical, 
  knobSize = 'md', 
  ledIndicator,
  ...props 
}, ref) => {
  const _value = props.value?.[0] ?? props.defaultValue?.[0] ?? 0
  const _max = props.max ?? 100
  const _min = props.min ?? 0
  const _percentage = ((value - min) / (max - min)) * 100

  const _knobSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  return (
    <div className={cn('relative', vertical ? 'h-full flex flex-col items-center' : 'w-full')}>
      <SliderPrimitive.Root
        ref={ref}
        className={cn(
          'relative flex touch-none select-none items-center',
          vertical ? 'flex-col h-full w-5' : 'w-full h-5',
          className
        )}
        orientation={vertical ? 'vertical' : 'horizontal'}
        {...props}
      >
        {/* Track background */}
        <SliderPrimitive.Track
          className={cn(
            'relative overflow-hidden rounded-full',
            'bg-gradient-to-b from-metal-950 via-metal-900 to-metal-800',
            'border border-metal-800 shadow-metal-inner',
            vertical ? 'h-full w-2' : 'h-2 w-full'
          )}
        >
          {/* Progress fill with gradient */}
          <SliderPrimitive.Range
            className={cn(
              'absolute',
              vertical ? 'w-full' : 'h-full',
              'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700',
              'shadow-[inset_0_1px_2px_rgba(59,130,246,0.5)]',
              'transition-all duration-150'
            )}
            style={{
              // Add glow effect based on value
              boxShadow: `
                inset 0 1px 2px rgba(59, 130, 246, 0.5),
                0 0 ${Math.max(5, percentage / 10)}px rgba(59, 130, 246, ${0.3 + percentage / 200})
              `
            }}
          />

          {/* LED-style segments (optional) */}
          {ledIndicator && (
            <div className={cn(
              'absolute inset-0 flex gap-0.5 p-0.5',
              vertical ? 'flex-col-reverse' : 'flex-row'
            )}>
              {Array.from({ length: 10 }).map((_, i) => {
                const _segmentActive = (i + 1) * 10 <= percentage
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex-1 rounded-sm transition-all duration-150',
                      segmentActive
                        ? i < 6
                          ? 'bg-accent shadow-glow-green'
                          : i < 8
                          ? 'bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.6)]'
                          : 'bg-red-500 shadow-glow-red'
                        : 'bg-metal-900/50'
                    )}
                  />
                )
              })}
            </div>
          )}
        </SliderPrimitive.Track>

        {/* Thumb/Knob */}
        <SliderPrimitive.Thumb
          className={cn(
            knobSizes[knobSize],
            'block rounded-full',
            'bg-gradient-to-br from-metal-500 via-metal-600 to-metal-800',
            'border-2 border-metal-900',
            'shadow-metal-raised',
            'cursor-grab active:cursor-grabbing',
            'transition-all duration-150',
            'hover:shadow-metal-lg hover:from-metal-400 hover:via-metal-500 hover:to-metal-700',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
            'disabled:pointer-events-none disabled:opacity-50',
            'relative overflow-hidden'
          )}
        >
          {/* Highlight effect */}
          <span className="absolute top-1/4 left-1/4 w-1/2 h-1/2 rounded-full bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
          
          {/* Center dot indicator */}
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-blue-400 shadow-glow-blue" />
        </SliderPrimitive.Thumb>
      </SliderPrimitive.Root>

      {/* Value display */}
      {showValue && (
        <div
          className={cn(
            'text-xs font-mono text-metal-300 mt-1',
            vertical && 'mt-2'
          )}
        >
          {valueDisplay ? valueDisplay(value) : value}
        </div>
      )}
    </div>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }