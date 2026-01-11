# R3VIBE Native - Audio Production Web Application

## Overview

R3VIBE Native is a web-based digital audio workstation (DAW) designed for music production. It features a 16-pad drum machine, 12-key piano keyboard with octave shifting, real-time audio effects (reverb, delay, flanger, reverse, vinyl), DJ controls (filter, pitch, crossfader), live recording with undo/redo, session save/load functionality, and audio visualization. The application follows professional audio software design patterns with a dark-first interface optimized for extended studio sessions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state, custom hooks for audio state
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Runtime**: Node.js with Express
- **API Style**: RESTful JSON API
- **Endpoints**: CRUD operations for session management (`/api/sessions`)
- **Storage**: In-memory storage with interface abstraction (IStorage) ready for database integration

### Audio Engine
- **Technology**: Web Audio API
- **Pattern**: Singleton audio engine with pub/sub state management
- **Features**: Sample playback, real-time effects processing, recording timeline, metronome
- **Keyboard Mapping**: QWERTY layout for drum pads, Z-row and number keys for piano

### Data Schema
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Validation**: Zod schemas with drizzle-zod integration
- **Models**: Users (auth), Sessions (project state including BPM, FX, recorded events)

### Design System
- **Theme**: Dark mode default with light and neon variants
- **Components**: Glass morphism effects, gradient backgrounds, professional audio-style controls
- **Typography**: Inter font family with tabular numbers for timing displays
- **Responsive**: 8-column pad grid on desktop, 4-column on mobile

## External Dependencies

### Database
- PostgreSQL (via Drizzle ORM, requires DATABASE_URL environment variable)
- Drizzle Kit for migrations

### UI Components
- Radix UI primitives (dialog, slider, select, tabs, etc.)
- shadcn/ui component library
- Lucide React icons
- Embla Carousel

### Audio
- Native Web Audio API (no external audio libraries)

### State & Data Fetching
- TanStack React Query for API calls
- React Hook Form with Zod resolver for forms

### Build & Development
- Vite for frontend bundling
- esbuild for server bundling
- TypeScript for type safety
- Replit-specific plugins for development (error overlay, cartographer, dev banner)