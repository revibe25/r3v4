import React, { useEffect } from "react";

interface Props {
  x: number;
  y: number;
  onDelete: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
  onClose: () => void;
}

export const ClipContextMenu: React.FC<Props> = ({
  x,
  y,
  onDelete,
  onDuplicate,
  onSplit,
  onClose,
}) => {
  useEffect(() => {
    const _close = () => onClose();
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [onClose]);

  return (
    <div
      className="fixed bg-muted border border-border rounded shadow z-50"
      style={{ left: x, top: y }}
    >
      <button className="block px-4 py-2" onClick={onDuplicate}>
        Duplicate
      </button>
      <button className="block px-4 py-2" onClick={onSplit}>
        Split at Playhead
      </button>
      <button className="block px-4 py-2 text-red-500" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
};
