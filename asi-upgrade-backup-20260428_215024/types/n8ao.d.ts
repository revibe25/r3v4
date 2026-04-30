declare module 'n8ao' {
  export class N8AOPostPass {
    configuration: {
      aoRadius: number;
      intensity: number;
      [key: string]: unknown;
    };
    constructor(...args: unknown[]);
    [key: string]: unknown;
  }
}
