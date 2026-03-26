# 🎨 Skills & Workflows: Visual Guide

**Quick reference diagrams to understand the systems**

---

## 🔄 The Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    YOU (Human Developer)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Describes task
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               ANTIGRAVITY AI AGENT                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. Reads your task description                       │  │
│  │  2. Scans installed skills in:                        │  │
│  │     • .agent/skills/ (workspace)                      │  │
│  │     • ~/.gemini/antigravity/skills/ (personal)        │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────┐          ┌──────────────┐
│   SKILLS     │          │  WORKFLOWS   │
│ AUTO-ACTIVATE│          │   MANUAL     │
└──────┬───────┘          └──────┬───────┘
       │                         │
       │                         │
       ▼                         ▼
┌──────────────────┐    ┌────────────────────┐
│ AI Behavior      │    │ Human-Guided       │
│ Changes:         │    │ Steps:             │
│ • Creates files  │    │ • Step 1: Build    │
│ • Follows rules  │    │ • Step 2: Test     │
│ • Applies method │    │ • Step 3: Deploy   │
└──────────────────┘    └────────────────────┘
```

---

## 🎯 Skills: Auto-Activation System

```
┌─────────────────────────────────────────────────┐
│  YOUR TASK: "Build a REST API with auth,       │
│  database, and testing. This is a complex       │
│  multi-step project requiring planning."        │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   Keyword Analysis    │
        │  ✓ "complex"          │
        │  ✓ "multi-step"       │
        │  ✓ "planning"         │
        └───────────┬───────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │  Skill Match: 95% confidence  │
    │  "planning-with-files"        │
    └───────────────┬───────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   SKILL ACTIVATED!    │
        │   AI reads SKILL.md   │
        │   Follows instructions│
        └───────────┬───────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │  AI Creates:                  │
    │  • task_plan.md               │
    │  • findings.md                │
    │  • progress.md                │
    │                               │
    │  AI Applies:                  │
    │  • 3-Strike Error Protocol    │
    │  • 2-Action Save Rule         │
    │  • Read-Before-Decide         │
    └───────────────────────────────┘
```

---

## 🏗️ Installation Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                    ANTIGRAVITY                          │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
        ▼                    ▼
┌──────────────────┐  ┌─────────────────────┐
│  PERSONAL SKILLS │  │  WORKSPACE SKILLS   │
│  (Global)        │  │  (Project-specific) │
├──────────────────┤  ├─────────────────────┤
│  Location:       │  │  Location:          │
│  ~/.gemini/      │  │  project/.agent/    │
│  antigravity/    │  │  skills/            │
│  skills/         │  │                     │
│                  │  │  Version Control:   │
│  Used in:        │  │  ✓ Git tracked      │
│  • ALL projects  │  │  ✓ Team shared      │
│                  │  │                     │
│  Pros:           │  │  Pros:              │
│  ✓ Available     │  │  ✓ Team standard    │
│    everywhere    │  │  ✓ Project custom   │
│  ✓ Personal      │  │  ✓ Versioned        │
│                  │  │                     │
│  Cons:           │  │  Cons:              │
│  ✗ Not shared    │  │  ✗ Only this proj   │
│  ✗ Not versioned │  │                     │
└──────────────────┘  └─────────────────────┘
         │                     │
         └──────────┬──────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │   SKILLS STACK       │
         │   (Both combined!)   │
         ├──────────────────────┤
         │  Personal Skills:    │
         │  • planning-with-    │
         │    files             │
         │  • code-review       │
         │                      │
         │  Workspace Skills:   │
         │  • company-standards │
         │  • domain-expert     │
         │                      │
         │  All can activate    │
         │  at the same time!   │
         └──────────────────────┘
```
