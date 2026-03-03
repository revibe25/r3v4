# R3VIBE Native - API Reference

**Version:** 1.0.0  
**Last Updated:** January 21, 2026  
**Base URL:** `http://localhost:3000/api`

---

## 📋 Table of Contents

1. [Effects API](#effects-api)
2. [Waveform API](#waveform-api)
3. [Presets API](#presets-api)
4. [Error Responses](#error-responses)
5. [Rate Limiting](#rate-limiting)

---

## Effects API

### GET /effects/presets

Retrieve all available effect presets.

**Request:**
```http
GET /api/effects/presets
```

**Response (200 OK):**
```json
[
  {
    "id": "preset-001",
    "name": "Warm Reverb",
    "category": "vocal",
    "tags": ["reverb", "smooth"],
    "isPremium": false,
    "author": "R3",
    "createdAt": "2026-01-21T10:00:00Z"
  }
]
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `category` | string | Filter by category (vocal, drum, synth, etc.) |
| `tag` | string | Filter by tag |
| `premium` | boolean | Filter premium presets |

---

### POST /effects/presets

Create a new effect preset.

**Request:**
```http
POST /api/effects/presets
Content-Type: application/json

{
  "name": "My Preset",
  "category": "vocal",
  "chain": {
    "id": "chain-1",
    "name": "Vocal Chain",
    "nodes": [
      {
        "id": "reverb-1",
        "type": "reverb",
        "params": {
          "enabled": true,
          "wet": 0.3,
          "dry": 0.7,
          "roomSize": 0.7,
          "damping": 0.5,
          "width": 1,
          "reverbType": "hall"
        },
        "bypass": false
      }
    ]
  },
  "tags": ["reverb", "vocal"],
  "isPremium": false
}
```

**Response (201 Created):**
```json
{
  "id": "preset-new-001",
  "name": "My Preset",
  "category": "vocal",
  "createdAt": "2026-01-21T10:05:00Z",
  "updatedAt": "2026-01-21T10:05:00Z"
}
```

---

### GET /effects/presets/:id

Get a specific preset by ID.

**Request:**
```http
GET /api/effects/presets/preset-001
```

**Response (200 OK):**
```json
{
  "id": "preset-001",
  "name": "Warm Reverb",
  "category": "vocal",
  "chain": { /* full chain data */ },
  "tags": ["reverb", "smooth"],
  "isPremium": false
}
```

**Error (404 Not Found):**
```json
{
  "error": "Preset not found"
}
```

---

### PUT /effects/presets/:id

Update an existing preset.

**Request:**
```http
PUT /api/effects/presets/preset-001
Content-Type: application/json

{
  "name": "Updated Name",
  "tags": ["reverb", "vocal", "new-tag"]
}
```

**Response (200 OK):**
```json
{
  "id": "preset-001",
  "name": "Updated Name",
  "updatedAt": "2026-01-21T10:10:00Z"
}
```

---

### DELETE /effects/presets/:id

Delete a preset.

**Request:**
```http
DELETE /api/effects/presets/preset-001
```

**Response (204 No Content)**

---

### GET /effects/chains

Retrieve all effect chains.

**Request:**
```http
GET /api/effects/chains
```

**Response (200 OK):**
```json
[
  {
    "id": "chain-001",
    "name": "Vocal Chain",
    "nodes": [
      {
        "id": "reverb-1",
        "type": "reverb",
        "params": { /* params */ },
        "bypass": false
      },
      {
        "id": "delay-1",
        "type": "delay",
        "params": { /* params */ },
        "bypass": false
      }
    ],
    "createdAt": "2026-01-21T10:00:00Z"
  }
]
```

---

### POST /effects/chains

Create a new effect chain.

**Request:**
```http
POST /api/effects/chains
Content-Type: application/json

{
  "name": "New Chain",
  "nodes": [
    {
      "id": "effect-1",
      "type": "reverb",
      "params": { /* effect params */ },
      "bypass": false
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "id": "chain-new-001",
  "name": "New Chain",
  "createdAt": "2026-01-21T10:05:00Z"
}
```

---

## Waveform API

### POST /waveform/analyze

Analyze an audio sample for properties and transients.

**Request:**
```http
POST /api/waveform/analyze
Content-Type: multipart/form-data

file: <audio-file>
```

**Response (200 OK):**
```json
{
  "sampleId": "sample-001",
  "duration": 10.5,
  "rms": 0.45,
  "peakLevel": 0.95,
  "crestFactor": 2.1,
  "spectralCentroid": 2400,
  "zeroCrossingRate": 0.08,
  "detectedBpm": 120,
  "detectedKey": "C major",
  "transients": [
    { "position": 0.1, "strength": 0.9, "type": "onset" },
    { "position": 0.5, "strength": 0.7, "type": "peak" }
  ],
  "silence": [
    { "start": 0, "end": 0.05 },
    { "start": 10.4, "end": 10.5 }
  ]
}
```

**Error (400 Bad Request):**
```json
{
  "error": "No file uploaded"
}
```

---

### POST /waveform/slice

Slice a sample into segments based on transient detection.

**Request:**
```http
POST /api/waveform/slice
Content-Type: multipart/form-data

file: <audio-file>
sensitivity: 0.8
useTransients: true
beatGridBased: false
minSliceLength: 50
```

**Response (200 OK):**
```json
{
  "sampleId": "sample-001",
  "slices": [
    {
      "id": "slice-1",
      "label": "Slice 1",
      "startTime": 0,
      "endTime": 0.5,
      "duration": 0.5,
      "tempo": 120
    },
    {
      "id": "slice-2",
      "label": "Slice 2",
      "startTime": 0.5,
      "endTime": 1.0,
      "duration": 0.5
    }
  ],
  "count": 2
}
```

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `sensitivity` | number | 0.7 | Transient detection sensitivity (0-1) |
| `useTransients` | boolean | true | Use transient detection |
| `beatGridBased` | boolean | false | Align slices to beat grid |
| `minSliceLength` | number | 50 | Minimum slice length in ms |

---

### POST /waveform/edit

Apply an edit operation to a sample.

**Request:**
```http
POST /api/waveform/edit
Content-Type: application/json

{
  "sampleId": "sample-001",
  "editType": "trim",
  "params": {
    "startTime": 0.5,
    "endTime": 9.5
  }
}
```

**Response (200 OK):**
```json
{
  "sampleId": "sample-001",
  "edits": [
    {
      "type": "trim",
      "appliedAt": 1674318000000,
      "duration": 9000
    }
  ],
  "success": true,
  "newDuration": 9.0,
  "newPeakLevel": 0.93
}
```

**Supported Edit Types:**

| Type | Params | Description |
|------|--------|-------------|
| `trim` | `startTime`, `endTime` | Trim to selection |
| `fade` | `direction`, `duration`, `curve` | Apply fade in/out |
| `normalize` | `targetLevel`, `analyzeSelection` | Normalize audio |
| `reverse` | `startTime`, `endTime` | Reverse section |
| `timewarp` | `stretch`, `usePhaseVocoder` | Change speed |
| `pitchshift` | `semitones`, `preserveFormants` | Shift pitch |
| `silence` | `startTime`, `endTime` | Silence section |

---

## Presets API

### GET /presets

Get all presets (effects, DJ, etc.).

**Request:**
```http
GET /api/presets
```

**Response (200 OK):**
```json
{
  "effects": [
    {
      "id": "preset-001",
      "name": "Warm Reverb",
      "category": "vocal",
      "tags": ["reverb"],
      "isPremium": false
    }
  ],
  "dj": [
    {
      "id": "dj-preset-001",
      "name": "Club Setup"
    }
  ]
}
```

---

### POST /presets/save

Save a complete preset package (effects + DJ settings).

**Request:**
```http
POST /api/presets/save
Content-Type: application/json

{
  "name": "Complete Setup",
  "type": "both",
  "data": {
    "effects": { /* effect chain */ },
    "dj": {
      "crossfaderCurve": "smooth",
      "hotCues": [ /* cue data */ ]
    }
  },
  "tags": ["club", "edm"]
}
```

**Response (201 Created):**
```json
{
  "id": "preset-complete-001",
  "name": "Complete Setup",
  "type": "both",
  "createdAt": "2026-01-21T10:05:00Z"
}
```

---

### GET /presets/:id

Get a specific preset by ID.

**Request:**
```http
GET /api/presets/preset-001
```

**Response (200 OK):**
```json
{
  "id": "preset-001",
  "name": "Warm Reverb",
  "type": "effect",
  "data": { /* full preset data */ },
  "createdAt": "2026-01-21T10:00:00Z"
}
```

---

### PUT /presets/:id

Update a preset.

**Request:**
```http
PUT /api/presets/preset-001
Content-Type: application/json

{
  "name": "Updated Name",
  "tags": ["reverb", "vocal", "warm"]
}
```

**Response (200 OK):**
```json
{
  "id": "preset-001",
  "name": "Updated Name",
  "updatedAt": "2026-01-21T10:10:00Z"
}
```

---

### DELETE /presets/:id

Delete a preset.

**Request:**
```http
DELETE /api/presets/preset-001
```

**Response (204 No Content)**

---

## Error Responses

### 400 Bad Request

```json
{
  "error": "Invalid parameters",
  "details": {
    "field": "name",
    "message": "Name is required"
  }
}
```

### 401 Unauthorized

```json
{
  "error": "Authentication required"
}
```

### 403 Forbidden

```json
{
  "error": "Access denied",
  "details": "You don't have permission to delete this preset"
}
```

### 404 Not Found

```json
{
  "error": "Resource not found",
  "resource": "Preset",
  "id": "preset-nonexistent"
}
```

### 409 Conflict

```json
{
  "error": "Resource already exists",
  "details": "A preset with this name already exists"
}
```

### 422 Unprocessable Entity

```json
{
  "error": "Validation failed",
  "errors": [
    {
      "field": "params.wet",
      "message": "Must be between 0 and 1"
    }
  ]
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred",
  "requestId": "req-12345"
}
```

---

## Rate Limiting

Rate limits apply to all endpoints:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/presets/*` | 100 req | 1 minute |
| `/effects/*` | 100 req | 1 minute |
| `/waveform/*` | 50 req | 1 minute |

**Response Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1674318060
```

**When Rate Limited (429):**
```json
{
  "error": "Too many requests",
  "retryAfter": 30
}
```

---

## Authentication

Include authentication token in headers:

```http
Authorization: Bearer <your-token>
```

Tokens are obtained during login:

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

---

## Best Practices

### 1. Error Handling

Always check HTTP status codes:

```javascript
fetch('/api/effects/presets')
  .then(res => {
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  })
  .catch(err => console.error('API error:', err));
```

### 2. Batching Requests

Group related operations:

```javascript
// Good: Single batch request
POST /api/presets/save with multiple effects

// Avoid: Multiple individual requests
POST /api/effects/presets
POST /api/effects/presets
POST /api/effects/presets
```

### 3. Caching

Cache preset data client-side:

```javascript
const presets = useMemo(() => fetchPresets(), []);
```

### 4. Validation

Validate parameters before sending:

```javascript
const validatePreset = (preset) => {
  if (!preset.name) throw new Error('Name required');
  if (preset.tags?.length > 10) throw new Error('Max 10 tags');
};
```

---

## Example Workflows

### Create and Use an Effect Preset

```javascript
// 1. Create preset
const response = await fetch('/api/effects/presets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Vocal Reverb',
    category: 'vocal',
    chain: { /* effect chain */ },
    tags: ['reverb', 'vocal']
  })
});

const preset = await response.json();

// 2. Retrieve it
const retrieved = await fetch(`/api/effects/presets/${preset.id}`);

// 3. Use in your audio pipeline
const presetData = await retrieved.json();
applyEffectChain(presetData.chain);

// 4. Update if needed
await fetch(`/api/effects/presets/${preset.id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tags: ['reverb', 'vocal', 'updated'] })
});
```

### Analyze and Slice a Sample

```javascript
// 1. Upload and analyze
const formData = new FormData();
formData.append('file', audioFile);

const analysis = await fetch('/api/waveform/analyze', {
  method: 'POST',
  body: formData
}).then(r => r.json());

console.log(`BPM: ${analysis.detectedBpm}`);
console.log(`Key: ${analysis.detectedKey}`);

// 2. Slice based on transients
const slices = await fetch('/api/waveform/slice', {
  method: 'POST',
  body: formData
}).then(r => r.json());

slices.slices.forEach(slice => {
  console.log(`${slice.label}: ${slice.duration}s`);
});

// 3. Edit individual slices
for (const slice of slices.slices) {
  await fetch('/api/waveform/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sampleId: slice.id,
      editType: 'fade',
      params: { direction: 'in', duration: 50 }
    })
  });
}
```

---

## Changelog

### v1.0.0 (January 21, 2026)
- Initial API release
- Effects, Waveform, Presets endpoints
- Full documentation