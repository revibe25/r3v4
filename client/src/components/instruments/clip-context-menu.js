import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
export const ClipContextMenu = ({ x, y, onDelete, onDuplicate, onSplit, onClose, }) => {
    useEffect(() => {
        const close = () => onClose();
        window.addEventListener("click", close);
        return () => window.removeEventListener("click", close);
    }, [onClose]);
    return (_jsxs("div", { className: "fixed bg-muted border border-border rounded shadow z-50", style: { left: x, top: y }, children: [_jsx("button", { className: "block px-4 py-2", onClick: onDuplicate, children: "Duplicate" }), _jsx("button", { className: "block px-4 py-2", onClick: onSplit, children: "Split at Playhead" }), _jsx("button", { className: "block px-4 py-2 text-red-500", onClick: onDelete, children: "Delete" })] }));
};
