import { useState, useCallback } from 'react';
import { uploadAudioFile, UploadResult } from '../services/upload';

export interface UploadState { uploading: boolean; progress: number; loaded: number; total: number; error: string | null; result: UploadResult | null; }
const INIT: UploadState = { uploading: false, progress: 0, loaded: 0, total: 0, error: null, result: null };

export function useAudioUpload() {
  const [state, setState] = useState<UploadState>(INIT);
  const upload = useCallback(async (file: File): Promise<UploadResult | null> => {
    setState({ ...INIT, uploading: true, total: file.size });
    try {
      const result = await uploadAudioFile(file, {
        onProgress: (progress, loaded, total) => setState(p => ({ ...p, progress, loaded, total })),
        onError: (error) => setState(p => ({ ...p, error, uploading: false })),
      });
      setState(p => ({ ...p, uploading: false, progress: 100, result }));
      return result;
    } catch (err) {
      setState(p => ({ ...p, uploading: false, error: err instanceof Error ? err.message : 'Upload failed' }));
      return null;
    }
  }, []);
  const reset = useCallback(() => setState(INIT), []);
  return { ...state, upload, reset };
}
