/**
 * Project Serializer
 * 
 * Handles serialization and deserialization of project state,
 * including validation, versioning, and migration.
 * 
 * @module utils/projectSerializer
 */

import type {
  ProjectState,
  _ProjectMetadata,
  _EffectChainState,
  _SidechainRouterState,
  _AutomationEngineState
} from '@/types/audio';

// ============================================
// CONSTANTS
// ============================================

const CURRENT_VERSION = '1.0.0';
const SUPPORTED_VERSIONS = ['1.0.0'];

// ============================================
// SERIALIZATION
// ============================================

/**
 * Serialize project state to JSON string
 */
export function serializeProject(state: ProjectState): string {
  try {
    const json = JSON.stringify(state, null, 2);
    console.log(`[ProjectSerializer] Serialized project (${json.length} bytes)`);
    return json;
  } catch (error) {
    console.error('[ProjectSerializer] Serialization failed:', error);
    throw new Error('Failed to serialize project');
  }
}

/**
 * Serialize and create downloadable blob
 */
export function serializeProjectToBlob(state: ProjectState): Blob {
  const json = serializeProject(state);
  return new Blob([json], { type: 'application/json' });
}

/**
 * Create a download link for project file
 */
export function downloadProject(state: ProjectState, filename?: string): void {
  const blob = serializeProjectToBlob(state);
  const url = URL.createObjectURL(blob);
  
  const name = filename || `${state.metadata.name}.json`;
  
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  
  URL.revokeObjectURL(url);
  
  console.log(`[ProjectSerializer] Downloaded project: ${name}`);
}

// ============================================
// DESERIALIZATION
// ============================================

/**
 * Deserialize project state from JSON string
 */
export function deserializeProject(json: string): ProjectState {
  try {
    const state = JSON.parse(json) as ProjectState;
    
    // Validate structure
    if (!validateProjectStructure(state)) {
      throw new Error('Invalid project structure');
    }
    
    // Check version compatibility
    if (!SUPPORTED_VERSIONS.includes(state.version)) {
      throw new Error(`Unsupported project version: ${state.version}`);
    }
    
    // Migrate if needed
    const migratedState = migrateProject(state);
    
    console.log('[ProjectSerializer] Deserialized project:', {
      name: migratedState.metadata.name,
      version: migratedState.version,
      channels: migratedState.channels.length,
    });
    
    return migratedState;
  } catch (error) {
    console.error('[ProjectSerializer] Deserialization failed:', error);
    throw new Error('Failed to deserialize project');
  }
}

/**
 * Load project from file
 */
export function loadProjectFromFile(file: File): Promise<ProjectState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const state = deserializeProject(json);
        resolve(state);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate project structure
 */
function validateProjectStructure(state: any): boolean {
  if (!state || typeof state !== 'object') {
    console.error('[ProjectSerializer] Invalid state: not an object');
    return false;
  }
  
  // Required top-level fields
  const requiredFields = [
    'version',
    'timestamp',
    'metadata',
    'sampleRate',
    'bufferSize',
    'channels',
    'masterBus',
    'effectChains',
    'sidechains',
    'automation',
  ];
  
  for (const field of requiredFields) {
    if (!(field in state)) {
      console.error(`[ProjectSerializer] Missing required field: ${field}`);
      return false;
    }
  }
  
  // Validate metadata
  if (!validateMetadata(state.metadata)) {
    return false;
  }
  
  // Validate arrays
  if (!Array.isArray(state.channels)) {
    console.error('[ProjectSerializer] Invalid channels: not an array');
    return false;
  }
  
  if (!Array.isArray(state.effectChains)) {
    console.error('[ProjectSerializer] Invalid effectChains: not an array');
    return false;
  }
  
  return true;
}

/**
 * Validate project metadata
 */
function validateMetadata(metadata: any): boolean {
  if (!metadata || typeof metadata !== 'object') {
    console.error('[ProjectSerializer] Invalid metadata: not an object');
    return false;
  }
  
  const requiredFields = ['name', 'created', 'modified'];
  
  for (const field of requiredFields) {
    if (!(field in metadata)) {
      console.error(`[ProjectSerializer] Missing metadata field: ${field}`);
      return false;
    }
  }
  
  if (typeof metadata.name !== 'string') {
    console.error('[ProjectSerializer] Invalid metadata.name: not a string');
    return false;
  }
  
  return true;
}

// ============================================
// MIGRATION
// ============================================

/**
 * Migrate project to current version
 */
function migrateProject(state: ProjectState): ProjectState {
  if (state.version === CURRENT_VERSION) {
    return state;
  }
  
  console.log(`[ProjectSerializer] Migrating from ${state.version} to ${CURRENT_VERSION}`);
  
  // Add migration logic here for future versions
  // Example:
  // if (state.version === '0.9.0') {
  //   state = migrateFrom0_9_0(state);
  // }
  
  return {
    ...state,
    version: CURRENT_VERSION,
  };
}

// ============================================
// UTILITIES
// ============================================

/**
 * Create a backup of project state
 */
export function createProjectBackup(state: ProjectState): ProjectState {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Compare two project states
 */
export function areProjectsEqual(state1: ProjectState, state2: ProjectState): boolean {
  // Quick checks
  if (state1.timestamp !== state2.timestamp) return false;
  if (state1.channels.length !== state2.channels.length) return false;
  if (state1.effectChains.length !== state2.effectChains.length) return false;
  
  // Deep comparison would be expensive, so this is a simple heuristic
  return JSON.stringify(state1) === JSON.stringify(state2);
}

/**
 * Extract project summary
 */
export function getProjectSummary(state: ProjectState): {
  name: string;
  version: string;
  channelCount: number;
  effectCount: number;
  automationLaneCount: number;
  sidechainCount: number;
  sizeEstimate: string;
} {
  const json = JSON.stringify(state);
  const sizeKB = new Blob([json]).size / 1024;
  
  return {
    name: state.metadata.name,
    version: state.version,
    channelCount: state.channels.length,
    effectCount: state.effectChains.reduce((sum, chain) => sum + chain.effects.length, 0),
    automationLaneCount: state.automation.lanes.length,
    sidechainCount: state.sidechains.connections.length,
    sizeEstimate: `${sizeKB.toFixed(1)} KB`,
  };
}

/**
 * Sanitize project name for filename
 */
export function sanitizeProjectName(name: string): string {
  return name
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
}