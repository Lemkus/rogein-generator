# Adding External Sounds to the Project

## Directory Structure
```
assets/
├── samples/
│   ├── xylophone/      # Existing xylophone samples
│   ├── sonar/          # Add sonar sounds here
│   ├── ui/             # UI feedback sounds
│   └── ambient/        # Ambient/environmental sounds
└── sounds/             # Alternative organization
```

## Step-by-Step Guide

### 1. Download Sounds
- Choose sounds with compatible licenses (CC0, CC BY preferred)
- Download in web-friendly formats (MP3, OGG, WAV)
- Keep file sizes reasonable (< 100KB for short sounds)

### 2. Optimize for Web
```bash
# Convert to MP3 (smaller size)
ffmpeg -i input.wav -acodec mp3 -ab 128k output.mp3

# Trim silence
ffmpeg -i input.mp3 -af silenceremove=1:0:-50dB output.mp3

# Normalize volume
ffmpeg -i input.mp3 -af loudnorm output.mp3
```

### 3. Add to Project
Place files in appropriate directory:
```
assets/samples/[category]/[sound-name].mp3
```

### 4. Load in JavaScript

#### Using Web Audio API directly:
```javascript
async function loadSound(url) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
}

// Usage
const sonarSound = await loadSound('./assets/samples/sonar/ping.mp3');
```

#### Using Tone.js (already in project):
```javascript
const sampler = new Tone.Sampler({
    urls: {
        "C4": "./assets/samples/sonar/ping.mp3",
    },
    release: 1,
}).toDestination();

// Play the sound
sampler.triggerAttackRelease("C4", "8n");
```

#### Using Howler.js (if you add it):
```javascript
const sound = new Howl({
    src: ['./assets/samples/ui/click.mp3'],
    volume: 0.5,
});

sound.play();
```

## Attribution Requirements

### For CC BY licenses:
Add attribution in your project:
```html
<!-- In index.html or credits -->
<div class="credits">
    Sound "Sonar Ping" by [Author] from Freesound.org (CC BY 3.0)
</div>
```

### Create attribution file:
```markdown
# Sound Credits

## Sonar Sounds
- "Submarine Ping" by UserXYZ - CC BY 3.0
  Source: https://freesound.org/people/UserXYZ/sounds/123456/

## UI Sounds  
- "Button Click" by AuthorABC - CC0 Public Domain
  Source: https://freesound.org/people/AuthorABC/sounds/789012/
```

## Example Integration

### 1. Create Sound Manager Module
```javascript
// src/modules/soundManager.js
export class SoundManager {
    constructor() {
        this.sounds = {};
        this.context = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    async loadSound(name, url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        this.sounds[name] = audioBuffer;
    }
    
    playSound(name, volume = 1.0) {
        if (!this.sounds[name]) return;
        
        const source = this.context.createBufferSource();
        const gainNode = this.context.createGain();
        
        source.buffer = this.sounds[name];
        source.connect(gainNode);
        gainNode.connect(this.context.destination);
        gainNode.gain.value = volume;
        
        source.start(0);
    }
}
```

### 2. Use in Simulator
```javascript
// In audio-navigation-simulator.html
const soundManager = new SoundManager();

// Load sounds on init
async function initSounds() {
    await soundManager.loadSound('targetReached', './assets/samples/ui/success.mp3');
    await soundManager.loadSound('sonarPing', './assets/samples/sonar/ping.mp3');
    await soundManager.loadSound('footstep', './assets/samples/ambient/step.mp3');
}

// Play when target reached
function checkTargetReached() {
    if (distance < tolerance) {
        soundManager.playSound('targetReached', 0.5);
        // ...
    }
}
```

## Recommended Sound Libraries for Web

### Lightweight
- **Tone.js** - Already in project, good for music/synthesis
- **Howler.js** - Simple, cross-browser audio
- **Pizzicato.js** - Easy effects and synthesis

### Full-Featured
- **Web Audio API** - Native, powerful, complex
- **SoundJS** - Part of CreateJS suite
- **Waud.js** - Good for games

## Free Sound Packs for Navigation

### Freesound Collections:
1. [UI Sound Pack](https://freesound.org/search/?q=ui+pack)
2. [Game Sounds](https://freesound.org/search/?q=game+sound+pack)
3. [Notification Sounds](https://freesound.org/search/?q=notification)

### OpenGameArt Packs:
1. [Interface Sounds](https://opengameart.org/content/interface-sounds-starter-pack)
2. [RPG Sound Pack](https://opengameart.org/content/rpg-sound-pack)

## Tips

1. **Keep it Simple**: Start with 3-5 key sounds
2. **Test on Mobile**: Ensure sounds work on iOS/Android
3. **Provide Fallbacks**: Have synthesized alternatives
4. **Cache Sounds**: Use service workers for offline
5. **Volume Control**: Always provide mute/volume options

## License Compatibility

For your open-source project:
- ✅ **CC0** (Public Domain) - No restrictions
- ✅ **CC BY** - Attribution required
- ✅ **MIT/BSD** - Code/asset licenses
- ⚠️ **CC BY-SA** - Share-alike requirement
- ⚠️ **CC BY-NC** - Non-commercial only
- ❌ **Copyrighted** - Need explicit permission
