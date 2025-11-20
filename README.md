# TrailSpot

**Find your spots on the trail!**

TrailSpot is a Progressive Web App (PWA) that helps outdoor enthusiasts discover and navigate to points on hiking trails using OpenStreetMap data and innovative "hot-cold" audio navigation.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-Ready-blue.svg)]()
[![OpenStreetMap](https://img.shields.io/badge/Data-OpenStreetMap-orange.svg)](https://www.openstreetmap.org/)

---

## Features

- **Trail Discovery** — Load hiking trails from OpenStreetMap using Overpass API
- **Smart Point Generation** — Automatically generate optimal navigation points while avoiding barriers
- **Hot-Cold Audio Navigation** — Find points using vibration and audio feedback (gets "hotter" as you approach!)
- **Mobile-First PWA** — Install on your phone and use offline
- **GPX Export** — Download routes for Garmin and other GPS devices
- **Save & Share Routes** — Save your favorite routes and share them via URL
- **Privacy-First** — All data stays on your device, no tracking

---

## Quick Start

### Online Version
Visit **[trailspot.app](https://trailspot.app)** (coming soon!)

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/trailspot.git
cd trailspot

# Open in browser (requires a local server for service worker)
python3 -m http.server 8000
# or
npx serve

# Visit http://localhost:8000
```

---

## How to Use

1. **Set Your Area** — Pan/zoom the map to your hiking location
2. **Generate Points** — Click "Generate Points" to create trail spots
3. **Navigate** — Select a target point and start audio navigation
4. **Save Route** — Save your route for later or share with friends
5. **Export GPX** — Download for Garmin or other GPS devices

---

## Project Structure

```
trailspot/
├── index.html              # Main HTML file
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker for offline support
├── src/
│   ├── app.js              # Main application coordinator
│   └── modules/
│       ├── optimizedOverpassAPI.js # OpenStreetMap data fetching
│       ├── serverOverpassAPI.js    # Server-side Overpass proxy
│       ├── mapModule.js            # Leaflet map management
│       ├── navigation.js           # Hot-cold audio navigation
│       ├── pointGeneration.js      # Point generation algorithms
│       ├── algorithms.js           # Graph algorithms (Dijkstra, etc.)
│       ├── utils.js                # Utility functions
│       └── storageAPI.js           # LocalStorage management
├── backend/
│   └── app/
│       └── simple_main.py  # FastAPI backend (for server-side features)
├── docs/                   # Documentation (see docs/README.md)
└── backend_simple.py       # Flask server-side Overpass API proxy
```

---

## Documentation

All project documentation is located in the `docs/` folder:

- **`docs/README.md`** - main documentation
- **`docs/architecture/`** - project architecture
- **`docs/development/`** - development rules
- **`docs/llm/`** - LLM instructions
- **`docs/user/`** - user documentation

**For LLM:** Start by reading `docs/development/AI_DEVELOPMENT_GUIDE.md`

---

## Technology Stack

### Frontend
- **Leaflet.js** — Interactive maps
- **Web Audio API** — Audio navigation feedback
- **Vibration API** — Haptic feedback
- **Service Workers** — Offline support (PWA)
- **LocalStorage** — Save routes locally

### Backend (Optional)
- **FastAPI** (Python) — Backend API
- **Flask** (Python) — Overpass API proxy

### Data Sources
- **OpenStreetMap** — Trail and map data ([ODbL license](https://opendatacommons.org/licenses/odbl/))
- **Overpass API** — OSM data queries

---

## Privacy & Security

TrailSpot is built with **privacy-first principles**:

- **No account required** — Use anonymously
- **No tracking** — Zero analytics or cookies
- **Local data** — Routes saved in your browser only
- **HTTPS only** — All connections encrypted
- **Open source** — Verify the code yourself!

See our [Privacy Policy](PRIVACY.md) for details.

---

## Legal

### Copyright
© 2025 **TrailSpot**. All rights reserved.

### License
This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

### Third-Party Data
- **OpenStreetMap data** © OpenStreetMap contributors, [ODbL license](https://opendatacommons.org/licenses/odbl/)
- **Map tiles** © OpenStreetMap contributors

### Terms of Use
By using TrailSpot, you agree to our [Terms of Use](TERMS.md).

**Safety Disclaimer:** TrailSpot is a navigation aid, not a replacement for proper outdoor equipment and safety practices. Always carry physical maps and use common sense. **Use at your own risk!**

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Bug Reports

Found a bug? Please [open an issue](https://github.com/yourusername/trailspot/issues) with:
- Description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)

---

## Contact

- **GitHub Issues:** [github.com/yourusername/trailspot/issues](https://github.com/yourusername/trailspot/issues)
- **Website:** [trailspot.app](https://trailspot.app) (coming soon!)

---

## Roadmap

- [ ] Multi-language support (EN, RU, ES, DE)
- [ ] Offline maps caching
- [ ] Route difficulty ratings
- [ ] Social features (share & compete)
- [ ] Integration with fitness trackers
- [ ] Custom point types (water, shelter, viewpoints)

---

## Acknowledgments

Made with love for outdoor enthusiasts by adventurers, for adventurers.

Special thanks to:
- **OpenStreetMap** community for amazing trail data
- **Leaflet.js** for the fantastic mapping library
- All contributors and beta testers!

---

**Happy trail spotting!**
