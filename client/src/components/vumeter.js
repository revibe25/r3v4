import { jsx as _jsx } from "react/jsx-runtime";
export const VUMeter = ({ level = 0, className = '' }) => {
    return (_jsx("div", { className: `vu-meter ${className}`, children: _jsx("div", { className: "vu-meter-bar", style: { height: `${level * 100}%` } }) }));
};
