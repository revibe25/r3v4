import { jsx as _jsx } from "react/jsx-runtime";
// @ts-nocheck
// ErrorBoundary.tsx
import React from "react";
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    render() {
        if (this.state.hasError) {
            return _jsx("div", { children: "Something went wrong." });
        }
        return this.props.children;
    }
}
