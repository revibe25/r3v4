/** Common interface all LLPTE adapters must implement */
export interface LLPTEAdapter {
  name:    string;
  version: string;
  /** Initialize adapter — called once before any transitions */
  init():  Promise<void>;
  /** Clean up resources */
  destroy(): void;
}
