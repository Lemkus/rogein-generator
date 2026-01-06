# Audio Navigation Simulator

## Overview

The Audio Navigation Simulator is an interactive web-based training tool designed to help users develop and test audio navigation skills. It simulates walking through a field with multiple target locations, providing audio feedback based on proximity to targets. This tool is perfect for testing different audio feedback strategies for navigation applications.

## Quick Start

### Running the Simulator

1. **Using the provided script (recommended):**
   ```bash
   python3 start_simulate_server.py
   ```
   Or on Windows:
   ```bash
   python start_simulate_server.py
   ```
   
2. **Using Python's HTTP server directly:**
   ```bash
   python3 -m http.server 8080
   ```
   Then open: `http://localhost:8080/audio-navigation-simulator.html`

3. **Opening directly in browser:**
   Simply open `audio-navigation-simulator.html` in a modern web browser

## Features

### Core Gameplay

- **Interactive Canvas**: 800x600px playing field with grid overlay
- **Player Movement**: Control a cyan circle (player) using keyboard or mouse
- **Target Collection**: Navigate to numbered yellow targets in sequence
- **Distance-Based Audio**: Sound feedback changes based on proximity to targets
- **Progress Tracking**: Visual progress bar and completion counter
- **Timer**: Track how long it takes to complete all targets

### Control Methods

#### Keyboard Controls
- **Arrow Keys** or **WASD**: Move the player
- **Space**: Start/stop simulation
- **R**: Reset game
- **M**: Toggle audio on/off

#### Mouse/Touch Controls
- Click anywhere on the canvas to move the player to that position
- Smooth movement towards clicked location

### Audio Feedback System

#### Sonar Mode
The primary audio mode that provides "hot-cold" style feedback:

- **Frequency Mapping**: Sound pitch increases as you get closer to target
- **Interval Mapping**: Beeps get faster as you approach the target
- **Distance Zones**: Visual zones show min/max distance thresholds
- **Configurable Parameters**:
  - Distance range (min/max)
  - Frequency range (Hz)
  - Interval range (ms)
  - Beep duration
  - Volume
  - Wave type (sine, triangle, square, sawtooth)

#### Sound Types
1. **Simple Beeps**: Basic Web Audio API beeps
2. **Musical (Xylophone)**: Musical notes using sampled sounds
3. **Advanced Navigation**: Integration with main navigation module
4. **Tone.js Synth**: Synthesized sounds using Tone.js library

### Blind Mode

A challenging mode where visual position feedback is hidden:

- **Toggle**: Check "Hide Position (Blind Mode)" checkbox
- **Hidden Elements**:
  - Player position on canvas
  - Direction line to target
  - Distance/direction indicators
  - Real-time audio parameter values
  - Parameter visualization plots
- **Shows**: Only targets and a "?" symbol
- **Purpose**: Test pure audio navigation skills without visual aids

### Parameter Visualization

Real-time plots showing how audio parameters change with distance:

- **Frequency Plot**: Shows frequency vs. distance mapping
- **Interval Plot**: Shows beep interval vs. distance mapping
- **Features**:
  - Piecewise linear function visualization
  - Clamping zones clearly marked
  - Current position indicator
  - Grid lines for reference
  - Value labels on hover

### Preset System

#### Built-in Presets
- **Close Range**: For small spaces (10-200px range)
- **Medium Range**: Balanced settings (20-400px range)
- **Far Range**: For large areas (50-800px range)
- **Submarine**: Deep sonar-like sounds
- **Sci-Fi**: Futuristic sound effects
- **Default**: Standard balanced settings

#### Custom Presets
- **Save Current**: Save your current parameter configuration
- **Load Custom**: Access your saved presets
- **Export**: Download presets as JSON file
- **Import**: Load presets from JSON file
- **Delete**: Remove unwanted custom presets
- **Storage**: Saved in browser's localStorage

### Color Themes

Eight beautiful color themes to choose from:

1. **Sky Blue** (Default): Bright, airy sky-inspired colors
2. **Dark Purple**: Original purple gradient theme
3. **Light Mode**: Clean white/gray with blue accents
4. **Smokey Gray**: Sophisticated grayscale
5. **Ocean Deep**: Deep sea blues and turquoise
6. **Forest Green**: Natural green tones
7. **Sunset**: Warm oranges and yellows
8. **Midnight Blue**: Dark navy theme

Themes affect:
- Background gradients
- UI elements and buttons
- Canvas and grid colors
- Player and target colors
- Text and borders
- Progress indicators

## User Interface

### Layout

```
┌─────────────────────────────────────────────────────────┐
│                    Header Controls                       │
│  [Start] [Reset] [Audio] [Settings...]  [Theme▼]        │
├──────────┬────────────────────────────────┬─────────────┤
│          │                                 │             │
│  Audio   │                                 │   Game      │
│  Params  │        Game Canvas              │   Info      │
│  Panel   │        (800 x 600)              │   Panel     │
│          │                                 │             │
│  Plots   │                                 │   Progress  │
│          │                                 │   Controls  │
└──────────┴────────────────────────────────┴─────────────┘
```

### Panels

#### Left Panel - Audio Parameters
- Distance mapping controls
- Frequency range sliders
- Interval range sliders
- Sound properties (duration, volume, wave type)
- Preset management buttons
- Real-time visualization plots

#### Right Panel - Game Information
- Current target indicator
- Distance and direction display
- Audio feedback information
- Progress bar and counter
- Timer display
- Control instructions

## Technical Details

### Audio Implementation

#### Web Audio API
- Dynamic oscillator creation
- Real-time frequency modulation
- Volume control via GainNode
- Multiple waveform types

#### Tone.js Integration
- Sampler for xylophone sounds
- Advanced synthesis options
- Better cross-browser compatibility

#### Audio Context Management
- Handles browser autoplay policies
- Single context reuse for performance
- Proper cleanup on stop

### Parameter Mapping

#### Linear Interpolation with Clamping
```javascript
function linearMap(value, inMin, inMax, outMin, outMax) {
    const clampedValue = Math.max(inMin, Math.min(inMax, value));
    return outMin + (outMax - outMin) * ((clampedValue - inMin) / (inMax - inMin));
}
```

#### Distance to Frequency
- Below minDist: Maximum frequency (urgent/close)
- Between minDist and maxDist: Linear interpolation
- Above maxDist: Minimum frequency (far away)

#### Distance to Interval
- Below minDist: Minimum interval (rapid beeping)
- Between minDist and maxDist: Linear interpolation
- Above maxDist: Maximum interval (slow beeping)

### Data Storage

#### localStorage Keys
- `selectedTheme`: Current color theme
- `sonarModeCustomPresets`: User's custom presets

#### Preset Format
```json
{
  "preset_name": {
    "minDist": 20,
    "maxDist": 400,
    "minFreq": 200,
    "maxFreq": 800,
    "minInterval": 200,
    "maxInterval": 2000,
    "beepDuration": 100,
    "volume": 30,
    "waveType": "sine",
    "displayName": "My Preset",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Browser Compatibility

### Minimum Requirements
- Modern browser with ES6 support
- Web Audio API support
- Canvas 2D rendering
- localStorage support

### Tested Browsers
- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Mobile Support
- Touch controls for movement
- Responsive design (may need viewport adjustments)
- Audio may require initial user interaction

## Use Cases

### Training & Education
- Audio navigation skill development
- Accessibility testing for vision-impaired navigation
- Spatial audio awareness training
- Sound design experimentation

### Development & Testing
- Testing audio feedback algorithms
- Parameter tuning for navigation apps
- Comparing different audio strategies
- User experience research

### Gaming & Entertainment
- Audio-only navigation challenges
- Reaction time training
- Competitive speedruns in blind mode
- Educational gameplay

## Tips & Strategies

### For Beginners
1. Start with visual mode to understand the mechanics
2. Use "Close Range" preset for easier audio feedback
3. Practice with fewer locations (2-3) initially
4. Focus on one parameter at a time (frequency or interval)

### For Advanced Users
1. Try Blind Mode for the ultimate challenge
2. Create custom presets for specific scenarios
3. Experiment with different wave types
4. Combine mouse and keyboard for faster navigation
5. Export and share your best preset configurations

### Audio Optimization
- **High contrast settings**: Max frequency difference, wide interval range
- **Subtle feedback**: Narrow frequency range, longer intervals
- **Musical navigation**: Use xylophone sounds with pentatonic scales
- **Emergency mode**: Very low minDist, high frequency, rapid beeping

## Troubleshooting

### No Sound
1. Check browser audio permissions
2. Click "Test Sound" button to initialize audio context
3. Ensure volume is not muted (check Volume slider)
4. Try different sound types (Simple/Musical/etc.)

### Performance Issues
1. Reduce number of locations
2. Use Simple Beeps instead of complex sounds
3. Close other browser tabs
4. Disable parameter plots if not needed

### Preset Issues
1. Clear browser cache if presets don't load
2. Export presets before clearing browser data
3. Check browser localStorage limits
4. Use unique names for custom presets

## Future Enhancements

### Planned Features
- Shepard tone mode for continuous rising/falling tones
- 3D spatial audio with stereo panning
- Haptic feedback support for mobile devices
- Recording and playback of navigation sessions
- Multiplayer competitive modes
- Path optimization scoring

### Possible Additions
- More sound samples (piano, bells, nature sounds)
- Visual impairment simulation modes
- GPS coordinate integration
- Real-world map overlays
- Voice guidance option
- Statistics and analytics

## Contributing

This simulator is part of the Rogein Generator project. To contribute:

1. Test different parameter combinations
2. Report bugs or issues
3. Suggest new features
4. Create and share preset collections
5. Improve accessibility features

## Credits

- Built with vanilla JavaScript and Web Audio API
- Uses Tone.js for advanced audio synthesis
- Xylophone samples from the project's audio assets
- Inspired by assistive navigation technologies

## License

Part of the Rogein Generator project. See main project LICENSE for details.
