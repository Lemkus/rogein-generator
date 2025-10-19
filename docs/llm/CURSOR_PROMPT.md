# 🎯 Cursor Prompt for RogeinProject

## System Prompt for Cursor

When working on this project, you are an expert JavaScript developer with deep knowledge of the RogeinProject codebase. Follow these rules strictly:

### 🚨 MANDATORY: Read these files FIRST
Before starting any task, you MUST read these files in order:
1. `LLM_QUICK_START.md` - Quick start guide
2. `docs/development/AI_DEVELOPMENT_GUIDE.md` - Main development rules
3. `docs/architecture/PROJECT_ARCHITECTURE.md` - Project structure
4. `docs/llm/LLM_INSTRUCTIONS.md` - LLM instructions

### 🚫 NEVER CREATE these files:
- `module_fixed.js`, `module_new.js`, `module_advanced.js`
- `module_simple.js`, `module_backup.js`, `module_unified.js`
- MD files in project root (except `LLM_QUICK_START.md`)
- Temporary files with suffixes (_temp, _draft, _backup)

### ✅ ALWAYS DO:
- Edit existing modules directly
- Create MD files in `docs/` by category
- Commit changes immediately: `git add src/modules/module.js && git commit -m "Description"`
- Deploy after commit: `python deploy_regru.py`

### 📁 Project Structure
The project has 12 active modules in `src/modules/`:
- `app.js` - Main coordinator
- `mapModule.js` - Map and visualization
- `navigation.js` - Navigation logic
- `fullscreenNavigation.js` - Fullscreen UI
- `pointGeneration.js` - Point generation
- `routeSequence.js` - Route optimization
- `sequenceUI.js` - Sequence management
- `storageAPI.js` - Data storage
- `optimizedOverpassAPI.js` - OSM data loading
- `serverOverpassAPI.js` - Server proxy
- `audioModuleAdvanced.js` - Audio signals
- `mediaSessionManager.js` - Media management

### 📚 Documentation Structure
All documentation is in `docs/` folder:
- `docs/architecture/` - Project architecture
- `docs/development/` - Development rules
- `docs/llm/` - LLM instructions
- `docs/user/` - User documentation

### 🔄 Workflow
1. Read required files from `docs/`
2. Edit existing module (NEVER create new)
3. Test changes
4. Commit: `git add src/modules/module.js && git commit -m "Description"`
5. Deploy: `python deploy_regru.py`

### 📝 MD File Creation Rules
- Architecture files → `docs/architecture/`
- Development files → `docs/development/`
- LLM files → `docs/llm/`
- User files → `docs/user/`
- NEVER create MD files in project root

### 🎯 Goal
Maintain clean, organized project structure without redundancy.

## Quick Reference

### For Code Changes:
- Edit existing modules only
- Follow development rules
- Commit and deploy immediately

### For Documentation:
- Create in appropriate `docs/` subfolder
- Update `docs/README.md` if needed
- Follow MD creation rules

### For New Features:
- Add to existing modules
- Don't create new modules
- Follow the established patterns

Remember: This project has been optimized for efficiency. Don't create redundant files or modules.
