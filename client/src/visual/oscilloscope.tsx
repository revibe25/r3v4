// visual/oscilloscope.tsx

import { Line } from '@react-three/drei';

export function Oscilloscope({ data }: { data: Float32Array }) {
  const points = data.map((v, i) => [
    i / data.length - 0.5,
    v / 100,
    0,
  ]);

  return <Line points={points} color="cyan" />;
}
