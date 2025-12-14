# TrailSpot (RogeinProject) - Technology Stack & Architecture

## Project Overview

**TrailSpot** is a **Progressive Web App (PWA)** for outdoor navigation and trail exploration. It helps users discover and navigate to points on hiking trails using OpenStreetMap data and an innovative "hot-cold" audio navigation system. The project features bilingual documentation (Russian/English) with significant Russian documentation.

## Technology Stack

### Frontend Stack

#### Core Technologies
- **Pure JavaScript (ES6+ modules)** - No framework, vanilla JS approach
- **HTML5** - Semantic markup with PWA support
- **CSS3** - Custom styling, responsive design

#### Mapping Libraries
- **Leaflet.js** - Interactive map visualization
- **Leaflet.Draw** - Drawing tools for map interactions

#### Web APIs Utilized
- **Web Audio API** - For "hot-cold" audio navigation feedback
- **Geolocation API** - GPS tracking
- **Vibration API** - Haptic feedback on mobile devices
- **Media Session API** - Media control integration
- **Service Workers** - Offline support & PWA functionality
- **Wake Lock API** - Prevents screen from sleeping during navigation
- **LocalStorage API** - Client-side data persistence

#### Progressive Web App (PWA)
- Installable on devices
- Works offline
- Service Worker caching strategy
- Web App Manifest

### Backend Stack

The project has **two backend implementations**:

#### 1. Simple Flask Backend (Currently Deployed)
- **Framework:** Flask 2.x + Flask-CORS
- **Purpose:** API proxy and route storage
- **Features:**
  - Proxies requests to Overpass API (OpenStreetMap data)
  - Route storage and sharing functionality
  - URL shortening integration
- **Storage:** JSON file-based (`routes_storage.json`)
- **File:** `backend_simple.py`

#### 2. Advanced FastAPI Backend (Available, Not Deployed)
- **Framework:** FastAPI 0.104.1
- **Database:** SQLAlchemy 2.0 + SQLite (aiosqlite)
- **Features:**
  - User authentication system (planned)
  - Training session tracking
  - GPX/KML export capabilities
  - Route ratings and comments
- **Containerization:** Docker support
- **Location:** `/backend` folder

### Data Sources
- **OpenStreetMap** via Overpass API
  - Trail and geographical data
  - ODbL license compliance
- **Overpass API** - OSM data queries
  - Primary endpoint: `https://overpass-api.de/api/interpreter`

## Architecture

### Frontend Module Structure (`src/modules/`)

```
app.js                    # Main application coordinator
├── mapModule.js          # Leaflet map management
├── navigation.js         # Hot-cold audio navigation logic
├── fullscreenNavigation.js   # Fullscreen UI mode
├── pointGeneration.js    # Algorithm for generating navigation points
├── routeSequence.js      # Route optimization (Dijkstra algorithm)
├── sequenceUI.js         # Sequence management UI
├── storageAPI.js         # Local storage management
├── optimizedOverpassAPI.js   # OSM data fetching with caching
├── serverOverpassAPI.js  # Server-side proxy for Overpass
├── audioModuleAdvanced.js    # Audio signal generation
├── mediaSessionManager.js    # Media control integration
├── uiController.js       # UI state management
├── utils.js              # Utility functions
├── algorithms.js         # Graph algorithms
├── config.js             # Configuration constants
└── apiClient.js          # API client utilities
```

### Backend API Endpoints

#### Currently Deployed (Flask)
- `POST /api/execute-query` - Proxy Overpass API queries
- `POST /api/save-route` - Save route data
- `GET /api/r/<route_id>` - Retrieve route by ID
- `POST /api/shorten` - URL shortening service
- `GET /r/<route_id>` - Short URL redirect

#### Available in FastAPI (Not Deployed)
- Routes management (`/api/routes/*`)
- Training sessions (`/api/training/*`)
- Export functionality (`/api/export/*`)
- Authentication (`/api/auth/*`)

## Deployment Configuration

### Current Production Environment
- **Domain:** `https://trailspot.app`
- **Hosting Provider:** REG.RU (Russian hosting)
- **Web Server:** Apache with Passenger WSGI module
- **Python Version:** 3.8+
- **Virtual Environment:** Required (`venv/` directory)

### Key Deployment Files
1. **`.htaccess`** - Minimal Passenger configuration
   ```apache
   Options -MultiViews
   PassengerEnabled On
   # Only this directive allowed on REG.RU!
   ```

2. **`passenger_wsgi.py`** - WSGI entry point with error handling
   - Auto-detects virtual environment
   - Comprehensive error reporting
   - Fallback mechanisms

3. **`backend_simple.py`** - Flask application
   - Exports `application` object for Passenger
   - CORS enabled for frontend communication

4. **`requirements.txt`** - Python dependencies
   ```
   flask>=2.0.0,<3.0.0
   werkzeug>=2.0.0,<3.0.0
   flask-cors
   requests
   ```

### Deployment Constraints (REG.RU Specific)
- Most Passenger directives are **forbidden**
- Only `PassengerEnabled On` allowed
- Passenger automatically detects:
  - Application type (WSGI)
  - Python version from venv
  - Entry point (`passenger_wsgi.py`)

## Core Features

### 1. Trail Point Generation
- Automatically generates navigation points on selected map areas
- Avoids barriers, water bodies, and restricted zones
- Graph-based algorithms for optimal point distribution
- Configurable difficulty levels

### 2. "Hot-Cold" Audio Navigation
- Progressive audio feedback based on distance
- Multiple sound patterns:
  - Far: Slow pulses
  - Medium: Moderate frequency
  - Close: Rapid pulses
  - Very close: Continuous tone
- Vibration feedback on mobile devices
- Visual indicators in fullscreen mode

### 3. Route Management
- Save routes locally (LocalStorage)
- Share routes via short URLs
- Export to GPX format for GPS devices
- Import previously saved routes
- Route statistics and completion tracking

### 4. Sequence Optimization
- Automatic route sequencing between points
- Shortest path calculation (Dijkstra's algorithm)
- Manual reordering support
- Progress tracking and statistics

## Development Workflow

### Core Development Principles
1. **DRY (Don't Repeat Yourself)** - Never duplicate code
2. **Single Source of Truth** - Each logic piece exists in ONE location
3. **Edit in Place** - Never create new module versions (`_fixed.js`, `_new.js`)
4. **KISS (Keep It Simple)** - Maintain simplicity, avoid over-engineering
5. **Documentation First** - All docs in `/docs` directory by category

### Typical Development Workflow
```bash
# 1. Make changes to existing modules (NEVER create new versions)
vim src/modules/module.js

# 2. Test locally
python3 -m http.server 8000
# or
npx serve

# 3. Commit changes
git add src/modules/module.js
git commit -m "Description of changes"
git push

# 4. Deploy to production (script referenced but not in repo)
python deploy_regru.py
```

### Documentation Structure
```
docs/
├── README.md                 # Main documentation
├── architecture/             # Project architecture
├── deployment/               # Deployment guides
├── development/              # Development rules
├── llm/                      # LLM/AI instructions
└── user/                     # User documentation
```

## Privacy & Security

### Privacy-First Design
- **No tracking** - Zero analytics or cookies
- **No user accounts required** - Anonymous usage
- **Local processing** - All route calculations done client-side
- **GPS data privacy** - Location never sent to server
- **Optional saving** - Routes saved only on user request
- **Open source** - Fully auditable codebase

### Security Measures
- HTTPS only connections
- CORS properly configured
- Input validation on all endpoints
- No sensitive data storage
- Minimal server-side processing

## Current Project Status

### Version Information
- **Current Version:** 1.12.71 (as per index.html)
- **Service Worker Version:** 1.12.56
- **Cache Strategy:** Network-first with fallback

### Active Features
- Point generation with barrier avoidance
- Audio navigation system
- Route saving and sharing
- GPX export
- Offline support
- PWA installation
- Fullscreen navigation mode

### Planned Features (from TODO)
- [ ] Multi-language support (EN, RU, ES, DE)
- [ ] Offline map caching
- [ ] Route difficulty ratings
- [ ] Social features (share & compete)
- [ ] Fitness tracker integration
- [ ] Custom point types (water, shelter, viewpoints)
- [ ] User authentication (FastAPI backend)

## Localization
- **Primary Documentation:** Russian
- **User Interface:** English
- **Code Comments:** Mixed (Russian/English)
- **Target Markets:** Russia, International outdoor enthusiasts

## Performance Optimizations

### Frontend
- Module-based code splitting
- Service Worker caching
- Lazy loading for map tiles
- Debounced API calls
- LocalStorage for offline data

### Backend
- Request proxying to reduce CORS issues
- Response caching (5-minute TTL)
- Minimal server processing
- Static file serving with cache headers

## Device Support

### Desktop Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Mobile Browsers
- Android Chrome 90+
- iOS Safari 14+
- Samsung Internet 14+

### Required Features
- Geolocation API support
- Service Worker support
- Web Audio API support
- ES6 modules support

## Development Tools

### Required
- Node.js 14+ (for local dev server)
- Python 3.8+ (for backend)
- Git (version control)

### Optional
- Docker (for FastAPI backend)
- PostgreSQL (for production database)
- Redis (for caching - planned)

## License & Legal

- **Project License:** MIT License
- **Map Data:** © OpenStreetMap contributors, ODbL license
- **Safety Disclaimer:** Navigation aid only, not a replacement for proper outdoor equipment

---

*This document provides a comprehensive overview of the TrailSpot/RogeinProject technology stack, architecture, and deployment configuration. For detailed implementation guides, refer to the specific documentation in the `/docs` directory.*
