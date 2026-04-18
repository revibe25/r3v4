export type AudioClipData = {
  id: string;
  trackId: string;

  url: string;          // audio file
  startTime: number;    // timeline seconds
  duration: number;

  offset: number;       // start offset inside file
  gain: number;
};
