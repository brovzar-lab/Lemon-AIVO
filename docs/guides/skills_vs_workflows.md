# 🧠 Skills vs Workflows: The Complete Guide

**Understanding the two systems that power Antigravity's intelligence**

---

## TL;DR - Quick Differences

| Aspect | Skills | Workflows |
|--------|--------|-----------|
| **What** | AI behavior instructions | Human step-by-step guides |
| **Who uses** | AI agent reads and follows | You (human) follow steps |
| **When activates** | Automatically based on task | Manually when you choose |
| **Format** | `SKILL.md` with frontmatter | `.md` with frontmatter |
| **Location** | `.agent/skills/` | `.agent/workflows/` |
| **Purpose** | Change how AI works | Guide your work process |
| **Example** | "Plan complex projects" | "Deploy to production" |

---

## 🎯 Skills: Instructions for the AI

### **What Are Skills?**

Skills are **instructions that modify how the AI agent behaves**. Think of them as "personality modules" or "expertise plugins" that you install to make the AI smarter about specific tasks.

**Analogy:** Skills are like installing Photoshop filters. Once installed, the AI automatically knows how to use them when appropriate.

### **How Skills Work**

```
1. You describe your task: "Build a REST API with auth..."
   ↓
2. Antigravity scans installed skills
   ↓
3. Matches your task to skill descriptions
   ↓
4. AUTO-ACTIVATES the relevant skill
   ↓
5. AI follows the skill's instructions throughout your conversation
```

**Key Point:** You don't "run" a skill. The AI automatically uses it!

### **Skill Anatomy**

```markdown
---
name: planning-with-files
description: Auto-activates for complex multi-step projects requiring planning
---

# Instructions for the AI

When activated, you MUST:
1. Create task_plan.md
2. Create findings.md  
3. Create progress.md
4. Follow the 3-Strike Error Protocol
5. Apply the 2-Action Rule
...
```

**Components:**
- **YAML Frontmatter**: Name and trigger description
- **Markdown Body**: Detailed instructions for AI behavior
- **Additional Files**: Templates, examples, references

### **Where Skills Live**

**Two locations:**

1. **Workspace Skills** (Team/Project-specific)
   ```
   your-project/.agent/skills/
   ```
   - ✅ Shared with team via git
   - ✅ Version controlled
   - ✅ Project-specific customization
   - ❌ Only available in this project

2. **Personal Skills** (Global)
   ```
   ~/.gemini/antigravity/skills/
   ```
   - ✅ Available in ALL your projects
   - ✅ Survives project switching
   - ❌ Not shared with team
   - ❌ Not version controlled

---

## 📋 Workflows: Step-by-Step Guides for Humans

### **What Are Workflows?**

Workflows are **structured step-by-step instructions for YOU (the human) to follow**, often with AI assistance on each step.

**Analogy:** Workflows are like recipes. You follow each step, and the AI helps you execute them.

### **How Workflows Work**

```
1. You choose a workflow: "I want to deploy to production"
   ↓
2. You (or AI) open the workflow file
   ↓
3. You follow each step in order
   ↓
4. AI helps execute commands/tasks at each step
   ↓
5. You complete the workflow manually
```

**Key Point:** Workflows are human-driven checklists with AI assistance!

### **Workflow Anatomy**

```markdown
---
description: Deploy application to production
---

# Deployment Workflow

## Step 1: Run Tests
// turbo
```bash
npm test
```

## Step 2: Build Production Bundle
```bash
npm run build
```

## Step 3: Deploy to Firebase
```bash
firebase deploy --only hosting
```

## Step 4: Verify Deployment
Visit: https://your-app.web.app
Check homepage loads correctly
```

---

## 🔄 Skills vs Workflows: Side-by-Side Comparison

### **Example: Deploying to Production**

**Using a SKILL:**
```
You: "Deploy the app to production carefully with testing and verification"

AI: [Reads deployment-expert skill]
     [Automatically follows best practices]
     [Runs tests]
     [Builds bundle]
     [Deploys]
     [Verifies]
     [Creates deployment.md log]

Result: AI handles everything following skill instructions
```

**Using a WORKFLOW:**
```
You: "Follow the deploy-to-production workflow"

AI: "Here are the steps:
     Step 1: Run tests - should I run 'npm test'?"
You: "Yes"
AI: [Runs tests]
AI: "Step 2: Build - should I run 'npm run build'?"
You: "Yes"
AI: [Builds]
... (you guide each step)

Result: You control the process, AI assists
```

### **When to Use Each?**

**Use SKILLS when:**
- ✅ You want AI to automatically handle complexity
- ✅ Task requires consistent methodology (like planning)
- ✅ You want behavior changes across multiple sessions
- ✅ Multiple people need same AI capabilities

**Examples:**
- Complex project planning
- Code review standards
- Testing strategies
- Documentation patterns

**Use WORKFLOWS when:**
- ✅ You need a repeatable process
- ✅ Steps must be done in specific order
- ✅ Some steps require human judgment
- ✅ You want to document your team's process

**Examples:**
- Deployment procedures
- Release checklists
- Onboarding new developers
- Debugging protocols
