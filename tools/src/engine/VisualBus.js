export class VisualBus {
  constructor() {
    this.layers = [];
  }

  add(layerFn) {
    this.layers.push(layerFn);
  }

  render(frame) {
    this.layers.forEach((fn) => fn(frame));
  }
}
