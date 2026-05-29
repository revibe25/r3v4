const fs = require('fs');
const path = require('path');

const file = 'client/src/audio/engine/worklet/processor.ts';
let content = fs.readFileSync(file, 'utf8');

// Remove duplicate declarations that exist in audio-worklet.d.ts
const lines = content.split('\n');
const filtered = lines.filter((line, i) => {
  // Keep the reference directive and other code
  if (line.includes('declare abstract class AudioWorkletProcessor')) return false;
  if (line.includes('declare const sampleRate')) return false;
  if (i < 10 && line.trim() === '}') return false; // closing brace of AudioWorkletProcessor
  if (i < 10 && line.includes('port:')) return false;
  if (i < 10 && line.includes('processorOptions')) return false;
  if (i < 10 && line.includes('constructor')) return false;
  if (i < 10 && line.includes('process(')) return false;
  if (i < 10 && line.includes('inputs:')) return false;
  if (i < 10 && line.includes('outputs:')) return false;
  if (i < 10 && line.includes('parameters:')) return false;
  return true;
});

// Add reference at top
const fixed = `/// <reference path="../worklets/audio-worklet.d.ts" />

${filtered.join('\n').trim()}`;

fs.writeFileSync(file, fixed + '\n');
console.log('✓ Fixed processor.ts');
