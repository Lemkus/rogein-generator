# Shepard Mode - Audio Navigation with Infinite Tones

## Overview

The Shepard Mode in the Audio Navigation Simulator uses the Shepard tone illusion - an auditory illusion of a tone that seems to continuously ascend or descend in pitch, yet never actually gets higher or lower. This creates a unique navigation experience where movement toward or away from targets produces an infinite rising or falling sensation.

## Mathematical Foundation

### Core Formula

The Shepard tone is constructed as a sum of sine waves separated by octaves:

```
Tone(t) = Σ c[i] * sin(2π * f[i] * t)
```

Where:
- **i** ranges from -N to +N (octave index)
- **f[i]** = frequency of octave i
- **c[i]** = amplitude coefficient for octave i
- **t** = time

### Distance-Based Frequency Mapping

Unlike traditional Shepard tones with fixed base frequency, our implementation uses **inverse distance mapping**:

```
f₀ = (220²) / distance = 48400 / distance
```

This creates a natural relationship:
- **Closer distances** → Higher frequencies
- **Farther distances** → Lower frequencies

#### Examples:
- At **110px**: f₀ = 440Hz (A4)
- At **220px**: f₀ = 220Hz (A3)
- At **440px**: f₀ = 110Hz (A2)
- At **300px**: f₀ = 161Hz (~E3)

### Octave Distribution

Each octave follows the standard frequency doubling:

```
f[i] = f₀ * 2^i
```

For example, with f₀ = 220Hz:
- f[-3] = 27.5Hz (A0)
- f[-2] = 55Hz (A1)
- f[-1] = 110Hz (A2)
- f[0] = 220Hz (A3)
- f[1] = 440Hz (A4)
- f[2] = 880Hz (A5)
- f[3] = 1760Hz (A6)

### Gaussian Amplitude Envelope

The key to the Shepard illusion is the amplitude envelope. We use a **Gaussian function** in logarithmic frequency space:

```
c[i] = exp(-(B * x[i])²)
```

Where:
- **x[i] = log₂(f[i] / f_center)** - logarithmic frequency position
- **B** = Gaussian width parameter (controls envelope spread)
- **f_center** = modulation center frequency (parameter)

This creates a bell curve that:
- Fades in low frequencies smoothly
- Peaks at the center frequency
- Fades out high frequencies smoothly

### The Illusion Mechanism

The infinite rising/falling illusion works because:

1. **Octave Equivalence**: Notes separated by octaves sound similar
2. **Smooth Envelope**: As high frequencies fade out, low frequencies fade in at the same pitch class
3. **Logarithmic Perception**: Human hearing perceives frequency logarithmically
4. **Continuous Spectrum**: Multiple octaves playing simultaneously mask discrete jumps

## Parameters Explained

### 1. Modulation Center (100-400Hz)
- **Purpose**: Sets the center of the Gaussian envelope
- **Effect**: Determines which frequencies are loudest
- **Default**: 220Hz (A3)
- **Note**: Does NOT affect the base pitch (that's distance-dependent)

### 2. Gaussian Width (0.5-2.0)
- **Narrow (0.5)**: Fewer audible octaves, more focused tone
- **Wide (2.0)**: More octaves audible, richer sound
- **Default**: 1.2
- **Trade-off**: Wider = richer but less defined pitch

### 3. Octave Range (±2 to ±4)
- **Purpose**: Number of octaves above and below fundamental
- **±2**: 5 total octaves (lighter processing)
- **±4**: 9 total octaves (fuller sound)
- **Default**: ±3 (7 octaves)

### 4. Chromatic Shift Speed (0-5 semitones/sec)
- **0**: Pure distance-based pitch (no movement effect)
- **>0**: Adds rising/falling based on movement direction
- **Default**: 0 (distance-only mode)
- **Use case**: Add urgency when approaching/leaving targets

### 5. Smoothing (0.8-0.99)
- **Purpose**: Smooths direction changes
- **Lower (0.8)**: More responsive to movement
- **Higher (0.99)**: Very smooth, slow transitions
- **Default**: 0.92

### 6. Volume (0-100%)
- **Purpose**: Overall loudness control
- **Default**: 30%
- **Note**: Multiple octaves sum, so keep moderate to avoid clipping

## Usage Guide

### Navigation Strategy

1. **Distance Awareness**
   - High pitch = Very close to target
   - Low pitch = Far from target
   - Use pitch to gauge approximate distance

2. **Movement Feedback**
   - Rising tone = Moving closer (if chromatic shift enabled)
   - Falling tone = Moving away
   - Stable tone = Stationary or lateral movement

3. **Finding Targets**
   - Move in different directions
   - Listen for pitch changes
   - Higher pitch indicates correct direction

### Optimal Settings

#### For Clear Navigation
```
- Modulation Center: 220Hz
- Gaussian Width: 1.0 (focused)
- Octave Range: ±3
- Chromatic Shift: 0 (distance-only)
- Smoothing: 0.92
```

#### For Rich Audio Experience
```
- Modulation Center: 220Hz
- Gaussian Width: 1.5 (wider)
- Octave Range: ±4
- Chromatic Shift: 2.0 (movement feedback)
- Smoothing: 0.95
```

#### For Fast Response
```
- Modulation Center: 300Hz (brighter)
- Gaussian Width: 0.8 (narrow)
- Octave Range: ±2 (fewer octaves)
- Chromatic Shift: 3.0 (rapid feedback)
- Smoothing: 0.85
```

## Technical Implementation

### Web Audio API Architecture

```javascript
// Oscillator setup (simplified)
for (octave = -N; octave <= N; octave++) {
    oscillator[octave] = audioContext.createOscillator();
    gainNode[octave] = audioContext.createGain();
    
    oscillator[octave].connect(gainNode[octave]);
    gainNode[octave].connect(masterGain);
}
```

### Update Loop

1. **Calculate distance** to current target
2. **Derive fundamental** frequency: f₀ = 48400 / distance
3. **Set octave frequencies**: f[i] = f₀ * 2^i
4. **Calculate amplitudes** using Gaussian envelope
5. **Apply smoothing** for seamless transitions
6. **Update oscillators** with new values

### Performance Considerations

- **CPU Usage**: Proportional to octave count
- **Memory**: Minimal (just oscillator state)
- **Latency**: ~20ms smoothing for click prevention
- **Browser Support**: Requires Web Audio API

## Comparison with Sonar Mode

| Aspect | Shepard Mode | Sonar Mode |
|--------|-------------|------------|
| **Feedback Type** | Continuous tone | Discrete beeps |
| **Pitch Range** | Infinite (illusion) | Limited (min/max) |
| **Distance Mapping** | Inverse (1/d) | Linear interpolation |
| **Movement Feedback** | Optional chromatic shift | Frequency + interval |
| **CPU Usage** | Higher (continuous) | Lower (intermittent) |
| **Learning Curve** | Moderate | Easy |
| **Precision** | Good | Excellent |
| **Immersion** | High | Moderate |

## Physics and Psychoacoustics

### Why Inverse Distance?

The formula f = k/d mimics physical phenomena:
- **Doppler effect** approximation
- **Sound intensity** follows inverse square law
- **Natural perception** of approaching sounds

### Logarithmic Frequency Space

Human hearing is logarithmic:
- Octaves are perceived as equal intervals
- Musical notes follow exponential frequency ratios
- Gaussian in log-space = natural loudness curve

### Pitch Class Equivalence

The illusion exploits octave equivalence:
- C4 (261Hz) and C5 (523Hz) sound related
- Brain groups octaves as same "pitch class"
- Smooth envelope transitions maintain illusion

## Troubleshooting

### Common Issues

1. **No infinite effect**
   - Check Gaussian width (too narrow?)
   - Verify octave range (need at least ±3)
   - Ensure smooth envelope transitions

2. **Clicking sounds**
   - Increase smoothing parameter
   - Check for CPU throttling
   - Reduce octave count if needed

3. **Pitch not changing with distance**
   - Verify Shepard mode is selected
   - Check if frozen in blind mode
   - Ensure targets are generated

4. **Too quiet/loud**
   - Adjust volume parameter
   - Check system volume
   - Consider Gaussian width effect on total amplitude

## Advanced Usage

### Combining with Movement

For most intuitive navigation:
1. Start with chromatic shift = 0
2. Learn pure distance mapping
3. Add small chromatic shift (0.5-1.0) for movement hints
4. Increase as needed for your preference

### Custom Frequency Mappings

The current formula (48400/distance) can be modified:

- **Steeper curve**: Use 96800/distance for more dramatic changes
- **Gentler curve**: Use 24200/distance for subtler effect
- **Power law**: Use 48400/distance^1.5 for non-linear response

### Multi-Target Awareness

With practice, you can:
- Identify direction to target by pitch gradient
- Estimate distance within ±50px
- Navigate without visual feedback
- Complete courses in blind mode

## Future Enhancements

### Planned Features
- Binaural spatial audio (left/right channel differences)
- Harmonic content variation (timbre changes)
- Dynamic envelope based on speed
- Multiple simultaneous Shepard tones for multiple targets

### Experimental Ideas
- Reverse Shepard (falling = closer)
- Shepard glissando for smooth transitions
- Rhythmic modulation for additional information
- Combination with haptic feedback

## Scientific Background

### References

1. **Shepard, R.N. (1964)** - "Circularity in Judgments of Relative Pitch"
2. **Deutsch, D. (1986)** - "The Tritone Paradox"
3. **Burns, E.M. (1981)** - "Circularity in Relative Pitch Judgments"

### Audio Illusions Family

The Shepard tone belongs to a family of auditory illusions:
- **Risset rhythm** - Infinite acceleration
- **Tritone paradox** - Ambiguous interval perception
- **Deutsch's scale illusion** - Melodic streaming
- **Binaural beats** - Frequency difference perception

## Conclusion

The Shepard Mode offers a unique navigation experience that combines mathematical elegance with perceptual psychology. The distance-based frequency mapping creates an intuitive relationship between space and sound, while the Gaussian-weighted octaves maintain the infinite illusion. 

This mode is particularly effective for:
- Creating immersive navigation experiences
- Training spatial awareness through sound
- Exploring psychoacoustic phenomena
- Developing alternative sensory interfaces

Master the parameters, understand the mathematics, and experience navigation through infinite tones!
