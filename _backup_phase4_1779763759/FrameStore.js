export class FrameStore {
  constructor() {
    this.frame = null;
    this.version = 0;
  }

  write(nextFrame) {
    this.frame = nextFrame;
    this.version++;
  }

  read() {
    return this.frame;
  }

  hasUpdate(lastVersion) {
    return this.version !== lastVersion;
  }
}
