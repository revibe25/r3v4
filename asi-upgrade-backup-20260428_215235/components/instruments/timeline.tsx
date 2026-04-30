import React from "react";
import { PIXELS_PER_SECOND } from "@/utils/time";

interface Props {
  maxTime: number;
}

export const Timeline: React.FC<Props> = ({ maxTime }) => (
  <div className="relative h-6 bg-card border-b border-border">
    {Array.from({ length: Math.ceil(maxTime) + 1 }).map((_, i) => (
      <div
        key={i}
        className="absolute top-0 w-px h-full bg-gray-600"
        style={{ left: i * PIXELS_PER_SECOND }}
      >
        <span className="absolute -top-5 text-xs text-muted-foreground">
          {i}s
        </span>
      </div>
    ))}
  </div>
);
