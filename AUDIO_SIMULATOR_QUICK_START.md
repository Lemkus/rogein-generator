# Audio Navigation Simulator - Quick Start Guide

## What is it?
An interactive web game that trains audio navigation skills. Navigate to targets using sound feedback that gets faster/higher as you get closer.

## How to Run
```bash
# Option 1: Use the dedicated server script
python3 start_simulate_server.py

# Option 2: Use Python's built-in server
python3 -m http.server 8080
# Then open: http://localhost:8080/audio-navigation-simulator.html

# Option 3: Just open the HTML file directly in your browser
```

## Quick Controls
- **Move**: Arrow keys or WASD
- **Start/Stop**: Space bar or click Start button
- **Reset**: R key or Reset button
- **Audio**: M key or Audio button
- **Click**: Move to clicked position

## Key Features

### 1. Audio Feedback Modes
- **Simple Beeps**: Basic electronic sounds
- **Musical**: Xylophone notes
- **Advanced**: Full navigation sounds
- **Tone.js**: Synthesized tones

### 2. Adjustable Parameters
- **Distance Range**: When sounds start/stop
- **Frequency Range**: How high/low the pitch goes
- **Interval Range**: How fast/slow the beeping
- **Volume & Duration**: Sound characteristics

### 3. Presets
**Built-in**: Close Range, Medium, Far, Submarine, Sci-Fi
**Custom**: Save your own settings, Export/Import as JSON

### 4. Blind Mode
Check "Hide Position" to hide your location and navigate by sound only!

### 5. Color Themes
8 themes: Sky Blue (default), Dark Purple, Light, Gray, Ocean, Forest, Sunset, Midnight

### 6. Visual Aids
- Real-time plots showing frequency/interval mapping
- Distance zones on canvas
- Progress tracking
- Direction indicators

## Game Objective
Navigate to all numbered targets in order. Use audio feedback to find them:
- **Closer** = Higher pitch + Faster beeping
- **Farther** = Lower pitch + Slower beeping

## Tips
1. Start with visual mode to learn
2. Try "Close Range" preset for clearer audio
3. Experiment with different sound types
4. Challenge yourself with Blind Mode
5. Create custom presets for your preferred settings

## File Locations
- **Main File**: `audio-navigation-simulator.html`
- **Server Script**: `start_simulate_server.py`
- **Custom Presets**: Saved in browser localStorage
- **Full Documentation**: `docs/user/AUDIO_NAVIGATION_SIMULATOR.md`

Enjoy training your audio navigation skills!
