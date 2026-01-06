# Shepard Mode - Quick Reference

## What Is It?
An audio navigation mode using the Shepard tone illusion - a sound that seems to rise or fall infinitely without actually changing. Perfect for continuous, immersive navigation feedback.

## How It Works
**Distance → Pitch**: `Frequency = 48400 / distance_in_pixels`
- **110px** → 440Hz (high pitch) - very close
- **220px** → 220Hz (medium pitch) - medium distance  
- **440px** → 110Hz (low pitch) - far away

## Quick Start
1. Select "Shepard Mode" from Audio Mode dropdown
2. Start the simulation
3. Move toward targets - hear pitch rise
4. Move away - hear pitch fall
5. The tone continues infinitely in either direction!

## Key Parameters

| Parameter | Purpose | Recommended |
|-----------|---------|-------------|
| **Modulation Center** | Which frequencies are loudest | 220Hz |
| **Gaussian Width** | How many octaves you hear | 1.2 |
| **Octave Range** | Total octaves playing | ±3 |
| **Chromatic Shift** | Movement-based pitch bend | 0 (distance only) |
| **Smoothing** | How smooth transitions are | 0.92 |
| **Volume** | Overall loudness | 30% |

## Navigation Tips
- **High pitch** = Close to target
- **Low pitch** = Far from target
- **Rising tone** = Getting closer (with chromatic shift)
- **Falling tone** = Getting farther
- **Stable tone** = Not changing distance

## Presets for Different Needs

### Clear Navigation (Default)
- Focus on distance-to-pitch mapping
- No movement effects
- Clear, defined tones

### Immersive Experience
- Width: 1.5 (richer sound)
- Chromatic Shift: 2.0 (movement feedback)
- Smoothing: 0.95 (very smooth)

### Quick Response
- Width: 0.8 (focused)
- Octave Range: ±2 (lighter)
- Smoothing: 0.85 (faster)

## Mathematical Magic
The illusion works using:
- **Multiple octaves** playing simultaneously (27Hz to 1760Hz)
- **Gaussian envelope** that fades octaves in/out smoothly
- **Logarithmic perception** of human hearing
- **Distance mapping**: closer = higher frequency

## VS Sonar Mode
- **Shepard**: Continuous tone, infinite pitch range, immersive
- **Sonar**: Beeping pulses, finite range, precise

## Try This!
1. Close your eyes
2. Navigate using only sound
3. Notice how pitch naturally indicates distance
4. Try to reach all targets without looking!

Full documentation: `docs/user/SHEPARD_MODE_GUIDE.md`
