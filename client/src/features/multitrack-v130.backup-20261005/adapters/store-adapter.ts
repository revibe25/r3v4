import { useDAWStore } from '@/hooks/useDAWStore';

export function getV130StoreSnapshot() {
  return useDAWStore.getState();
}

export const v130Store = {
  getSnapshot: getV130StoreSnapshot,
};
