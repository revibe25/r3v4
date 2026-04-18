/**
 * Client Entry Point
 * Initializes audio and application
 */

import { attachAudioInitTriggers } from './audio-init.js';

// Initialize audio on user gesture
attachAudioInitTriggers();

console.log('✓ R3 v4 client initialized');
