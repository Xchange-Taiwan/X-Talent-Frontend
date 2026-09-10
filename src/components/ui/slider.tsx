import * as SliderPrimitive from '@radix-ui/react-slider';
import * as React from 'react';

import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex w-full touch-none items-center select-none',
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-background-border">
      <SliderPrimitive.Range className="absolute h-full bg-brand-500" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        'block size-5 cursor-pointer rounded-full border-2 border-brand-500 bg-background-white ring-offset-background-white transition-colors disabled:pointer-events-none disabled:opacity-50',
        FOCUS_RING_CLASSES
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
