import { useState, useCallback } from 'react';
import { uploadAudioFile } from '../services/upload';
const INIT = { uploading: false, progress: 0, loaded: 0, total: 0, error: null, result: null };
export function useAudioUpload() {
    const [state, setState] = useState(INIT);
    const upload = useCallback(async (file) => {
        setState({ ...INIT, uploading: true, total: file.size });
        try {
            const result = await uploadAudioFile(file, {
                onProgress: (progress, loaded, total) => setState(p => ({ ...p, progress, loaded, total })),
                onError: (error) => setState(p => ({ ...p, error, uploading: false })),
            });
            setState(p => ({ ...p, uploading: false, progress: 100, result }));
            return result;
        }
        catch (err) {
            setState(p => ({ ...p, uploading: false, error: err instanceof Error ? err.message : 'Upload failed' }));
            return null;
        }
    }, []);
    const reset = useCallback(() => setState(INIT), []);
    return { ...state, upload, reset };
}
