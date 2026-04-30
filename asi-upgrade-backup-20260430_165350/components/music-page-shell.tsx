import type { ReactNode } from "react";
import { MusicAppNav } from "@/components/music-app-nav";

export interface MusicPageShellProps {
  header?: ReactNode;
  transportBar?: ReactNode;
  children: ReactNode;
}

export function MusicPageShell({
  header,
  transportBar,
  children,
}: MusicPageShellProps) {
  return (
    <>
      <header className="ag-header">
        {header}
        <MusicAppNav />
      </header>
      {transportBar}
      <main className="ag-frame ag-content">{children}</main>
    </>
  );
}