export interface AIMixRequest {
  fromTrackId: string;
  toTrackId:   string;
  fromBpm:     number;
  toBpm:       number;
  fromKey:     string;
  toKey:       string;
}

export interface AIMixSuggestion {
  trackId:         string;
  transitionPoint: number;  // seconds into fromTrack
  confidence:      number;  // 0.0–1.0
  suggestedParams: {
    durationMs: number;
    curve:      string;
  };
}
