import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // Base metal button styles
  `relative inline-flex items-center justify-center gap-2 whitespace-nowrap 
   rounded-md text-sm font-semibold transition-all duration-150 
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 
   disabled:pointer-events-none disabled:opacity-50 select-none
   shadow-metal-raised border-t border-l
   active:shadow-metal-pressed active:translate-y-0.5`,
  {
    variants: {
      variant: {
        default: `
          bg-gradient-to-b from-metal-600 via-metal-700 to-metal-800
          border-metal-500 border-r border-b border-metal-900
          text-metal-100
          hover:from-metal-500 hover:via-metal-600 hover:to-metal-700
          hover:shadow-metal-lg hover:-translate-y-0.5
          active:from-metal-700 active:via-metal-800 active:to-metal-900
        `,
        primary: `
          bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800
          border-blue-500 border-r border-b border-blue-900
          text-white shadow-glow-blue
          hover:from-blue-500 hover:via-blue-600 hover:to-blue-700
          hover:shadow-[0_0_25px_rgba(59,130,246,0.6)]
          active:from-blue-700 active:via-blue-800 active:to-blue-900
        `,
        destructive: `
          bg-gradient-to-b from-red-600 via-red-700 to-red-800
          border-red-500 border-r border-b border-red-900
          text-white shadow-glow-red
          hover:from-red-500 hover:via-red-600 hover:to-red-700
          hover:shadow-[0_0_25px_rgba(239,68,68,0.6)]
          active:from-red-700 active:via-red-800 active:to-red-900
        `,
        success: `
          bg-gradient-to-b from-green-600 via-green-700 to-green-800
          border-green-500 border-r border-b border-green-900
          text-white shadow-glow-green
          hover:from-green-500 hover:via-green-600 hover:to-green-700
          hover:shadow-[0_0_25px_rgba(34,197,94,0.6)]
          active:from-green-700 active:via-green-800 active:to-green-900
        `,
        warning: `
          bg-gradient-to-b from-orange-600 via-orange-700 to-orange-800
          border-orange-500 border-r border-b border-orange-900
          text-white shadow-glow-orange
          hover:from-orange-500 hover:via-orange-600 hover:to-orange-700
          hover:shadow-[0_0_25px_rgba(249,115,22,0.6)]
          active:from-orange-700 active:via-orange-800 active:to-orange-900
        `,
        outline: `
          bg-gradient-to-b from-transparent via-metal-900/30 to-metal-900/50
          border-metal-700 border border-r-metal-800 border-b-metal-800
          text-metal-200
          hover:from-metal-800/30 hover:via-metal-800/50 hover:to-metal-800/70
          hover:border-metal-600
          active:from-metal-900/50 active:via-metal-900/70 active:to-metal-900/90
        `,
        ghost: `
          bg-transparent border-transparent shadow-none
          text-metal-200
          hover:bg-metal-800/50 hover:text-metal-100
          active:bg-metal-900/70
        `,
        link: `
          bg-transparent border-transparent shadow-none
          text-blue-400 underline-offset-4
          hover:underline hover:text-blue-300
          active:text-blue-500
        `,
        // DAW-specific variants
        transport: `
          bg-gradient-to-b from-metal-600 via-metal-700 to-metal-800
          border-metal-500 border-r border-b border-metal-900
          text-metal-100 rounded-full
          hover:from-metal-500 hover:via-metal-600 hover:to-metal-700
          hover:shadow-metal-lg
        `,
        record: `
          bg-gradient-to-b from-red-600 via-red-700 to-red-800
          border-red-500 border-r border-b border-red-900
          text-white rounded-full shadow-glow-red
          hover:shadow-[0_0_30px_rgba(239,68,68,0.8)]
          animate-pulse-glow
        `,
        play: `
          bg-gradient-to-b from-green-600 via-green-700 to-green-800
          border-green-500 border-r border-b border-green-900
          text-white rounded-full shadow-glow-green
          hover:shadow-[0_0_30px_rgba(34,197,94,0.8)]
        `,
        led: `
          bg-gradient-to-b from-metal-800 via-metal-900 to-metal-950
          border-metal-900 shadow-metal-inner
          w-8 h-8 p-0 rounded-full
          hover:border-metal-700
        `,
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-8 text-lg',
        icon: 'h-10 w-10 p-0',
        'icon-sm': 'h-8 w-8 p-0',
        'icon-lg': 'h-12 w-12 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  active?: boolean
  glow?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, active, glow, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          active && 'shadow-metal-pressed translate-y-0.5',
          glow && 'shadow-glow-blue'
        )}
        ref={ref}
        {...props}
      >
        {/* Highlight overlay for 3D effect */}
        <span className="absolute inset-0 rounded-md pointer-events-none">
          <span className="absolute top-0 left-0 right-0 h-1/3 rounded-t-md bg-gradient-to-b from-white/10 to-transparent" />
        </span>
        
        {/* Content */}
        <span className="relative z-10 flex items-center gap-2">
          {children}
        </span>
        
        {/* Active/pressed indicator */}
        {active && (
          <span className="absolute inset-0 rounded-md bg-black/20 pointer-events-none" />
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }