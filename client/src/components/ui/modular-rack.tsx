// ui/modular-rack.tsx

export function Rack({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-12 gap-2 bg-black/40 p-2 rounded-xl">
      {children}
    </div>
  );
}
