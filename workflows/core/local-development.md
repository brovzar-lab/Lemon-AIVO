---
description: Local-only development workflow - Test locally, deploy manually
---

# Local Development Workflow

> **Philosophy:** Work locally by default. Deploy to Firebase ONLY when explicitly ready.

---

## 🏠 LOCAL DEVELOPMENT (Default Mode)

### 1. Starting Your Dev Server

```bash
npm run dev
```

- **URL:** http://localhost:5173
- **Auto-reload:** Changes appear instantly (Hot Module Replacement)
- **Safe:** Nothing affects production
- **When to use:** 99% of the time during development

### 2. Testing Your Changes

**Always test in the browser at `localhost:5173`**

✅ **DO:**
- Make code changes
- Refresh browser to see updates
- Test features thoroughly
- Commit to git when satisfied

❌ **DON'T:**
- Run `npm run build` (unless testing production build)
- Run `firebase deploy` (unless ready for production)
- Run `npm run deploy` (this builds + deploys automatically)

---

## 🚀 PRODUCTION DEPLOYMENT (Manual Only)

### When to Deploy:
- ✅ Feature is complete and tested locally
- ✅ All tests pass
- ✅ Changes committed to git
- ✅ User explicitly requests deployment

### Deployment Steps:

```bash
# Step 1: Build production bundle
npm run build

# Step 2: Verify the build succeeded
ls -la dist/

# Step 3: (Optional) Preview production build locally
npm run preview
# Opens http://localhost:4173 with production build

# Step 4: Deploy to Firebase
firebase deploy --only hosting

# OR use the shortcut (builds + deploys):
npm run deploy
```

---

## 🛡️ ANTIGRAVITY GUIDELINES

### For the AI Agent:

**NEVER auto-run these commands:**
- `npm run build` 
- `npm run deploy`
- `firebase deploy`
- Any command containing "deploy" or "build"

**SafeToAutoRun = false for:**
- Production builds
- Firebase deployments
- Version bumps (package.json changes)

**ALWAYS ask the user before:**
- Building production bundles
- Deploying to Firebase
- Making deployment-related changes

### For the User:

**Before approving ANY command:**
- Read the command carefully
- Check if it contains "build" or "deploy"
- If yes, confirm it's intentional
- If unsure, reject and ask

---

## 📋 QUICK REFERENCE

| Task | Command | When |
|------|---------|------|
| **Start dev server** | `npm run dev` | Every time you code |
| **Stop dev server** | `Ctrl+C` or `Cmd+C` | When done |
| **Test changes** | Visit `localhost:5173` | After every change |
| **Build for production** | `npm run build` | Before deploying only |
| **Preview production** | `npm run preview` | Optional QA step |
| **Deploy to Firebase** | `npm run deploy` | When explicitly ready |

---

## 🔍 VERIFICATION COMMANDS

### Check if dev server is running:
```bash
lsof -i :5173
```

### Check current version in code:
```bash
cat package.json | grep version
```

### Check version in dist (if built):
```bash
cat dist/assets/*.js | grep -o "v2\.[0-9]*\.[0-9]*" | head -1
```

### Check what's deployed on Firebase:
```bash
firebase hosting:channel:list
```

---

## ⚠️ COMMON MISTAKES TO AVOID

### ❌ Mistake #1: Deploying without building
```bash
# WRONG - deploys old dist/ files
firebase deploy
```

### ✅ Correct:
```bash
# RIGHT - builds fresh, then deploys
npm run deploy
```

---

### ❌ Mistake #2: Testing production build instead of dev
```bash
# WRONG - slow, requires rebuild after every change
npm run build
npm run preview
```

### ✅ Correct:
```bash
# RIGHT - instant updates during development
npm run dev
```

---

### ❌ Mistake #3: Accidental deployment via AI
```bash
# AI runs this without asking:
npm run deploy  # SafeToAutoRun: true ← WRONG
```

### ✅ Correct:
```bash
# AI asks permission first:
npm run deploy  # SafeToAutoRun: false ← RIGHT
```

---

## 🎯 WORKFLOW SUMMARY

```
┌─────────────────────────────────────┐
│   NORMAL DEV CYCLE (Loop Daily)     │
├─────────────────────────────────────┤
│                                     │
│  1. npm run dev                     │
│  2. Code changes                    │
│  3. Test at localhost:5173          │
│  4. Repeat steps 2-3                │
│  5. Commit to git when satisfied    │
│                                     │
└─────────────────────────────────────┘

         ↓ (Only when ready)

┌─────────────────────────────────────┐
│   DEPLOYMENT CYCLE (Rare/Manual)    │
├─────────────────────────────────────┤
│                                     │
│  1. Stop dev server (Ctrl+C)        │
│  2. npm run build                   │
│  3. npm run preview (optional QA)   │
│  4. firebase deploy                 │
│  5. Verify at production URL        │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔗 Production URL

- **Live Site:** https://screenpartner-16217665-33d08.web.app
- **Firebase Console:** https://console.firebase.google.com/project/screenpartner-16217665-33d08

**Check this URL only AFTER deploying, not during local development.**

---

## 📝 NOTES

- The `dist/` folder is **git-ignored** (not committed)
- Each build creates a fresh `dist/` folder
- Firebase deploys whatever is in `dist/` at deployment time
- Local dev server (`npm run dev`) NEVER touches `dist/`
- Dev server uses source files directly from `src/`

---

**Last Updated:** 2026-01-26  
**Current Version:** v2.12.1
