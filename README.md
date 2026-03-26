# MASTER-LIBRARY

A centralized library of AI agents, skills, workflows, integrations, rules, and templates. This is the single source of truth for reusable components—never copied wholesale into projects, but selectively pulled as needed via `init.sh` in APP-TEMPLATE.

## Philosophy

MASTER-LIBRARY prevents duplication and drift. Instead of copying entire folders into every new project, new projects use the APP-TEMPLATE with an optional `init.sh` that pulls only the components they need. This keeps all instances of a skill, agent, or workflow in sync and reduces maintenance burden.

---

## Folder Structure

```
MASTER-LIBRARY/
├── agents/                  # AI agent personas (19 core + 127 domain-specific)
│   ├── core/               # Foundation agents for any project
│   ├── domain/             # Specialized agents by discipline
│   │   ├── design/
│   │   ├── engineering/
│   │   ├── marketing/
│   │   ├── sales/
│   │   ├── project-management/
│   │   ├── game-development/
│   │   ├── film-production/
│   │   ├── testing/
│   │   ├── support/
│   │   ├── spatial-computing/
│   │   ├── product/
│   │   └── specialized/
│   └── strategy/            # Executive guides and strategic playbooks
│
├── skills/                  # Reusable task-specific capabilities (62 total)
│   ├── development/        # 40 coding & build skills
│   ├── design/            # 5 design & layout skills
│   ├── creative/          # 6 content & creative skills
│   ├── documents/         # 4 documentation & markdown skills
│   └── meta/              # 7 system & meta-level skills
│
├── workflows/              # Multi-step processes (17 total)
│   ├── core/              # 15 fundamental workflows
│   └── strategy/          # 2 strategic planning workflows
│
├── templates/              # Scaffolding and starter files
│   ├── app-scaffolds/     # Framework-specific boilerplate
│   └── three-file-system/ # Minimal three-file starter structure
│
├── integrations/           # Tool-specific configurations (8 tools)
│   ├── claude-code/       # Anthropic Claude CLI
│   ├── aider/             # AI pair programming
│   ├── cursor/            # Cursor IDE
│   ├── windsurf/          # Codeium Windsurf
│   ├── github-copilot/    # GitHub Copilot
│   ├── opencode/          # OpenCode
│   ├── gemini-cli/        # Google Gemini CLI
│   └── mcp-memory/        # MCP memory integration
│
├── rules/                  # Coding standards and constraints
│   ├── GLOBAL_RULES.md    # Universal rules for all projects
│   └── GEMINI.md          # Gemini-specific guidelines
│
├── docs/                   # Reference documentation
│   ├── examples/          # Working code examples
│   ├── guides/            # How-to documentation
│   └── prompts/           # Prompt templates and patterns
│
├── strategy/               # Strategic framework and planning
│   ├── playbooks/         # Go-to-market and operational playbooks
│   └── runbooks/          # Repeatable procedures
│
├── scripts/               # Utility and automation scripts
│
├── reference-projects/    # Complete example projects
│   └── ai-intel-agent/    # Full reference implementation
│
└── .shared/               # Shared resources (UI/UX utilities)
    └── ui-ux-pro-max/     # Design system & component data
```

---

## Agent Inventory

### Core Agents (19)
Foundation personas for general-purpose tasks:
- Backend Specialist, Frontend Specialist, Full-Stack Developer
- Database Architect, DevOps Engineer, Performance Optimizer
- Security Auditor, Penetration Tester
- Project Planner, Product Manager, Orchestrator
- QA Automation Engineer, Debugger
- Code Archaeologist, Documentation Writer
- Game Developer, Mobile Developer
- Explorer Agent

### Domain-Specific Agents (127)

**Design** (8 agents)
- UI/UX specialists, design system experts, interaction designers

**Engineering** (16 agents)
- Language-specific developers, architecture specialists, infrastructure engineers

**Marketing** (18 agents)
- Content strategists, campaign specialists, brand managers, growth marketers

**Sales** (8 agents)
- Deal strategists, proposal specialists, relationship managers, revenue operators

**Project Management** (7 agents)
- Agile coaches, timeline experts, risk managers, stakeholder liaisons

**Game Development** (5 agents)
- Unreal Engine, Unity, Godot, Roblox Studio specialists

**Film Production** (16 agents)
- Cinematographers, editors, producers, VFX specialists, sound designers

**Testing** (8 agents)
- QA strategists, automation engineers, security testers, load test engineers

**Support** (6 agents)
- Customer success specialists, technical support, onboarding experts

**Spatial Computing** (6 agents)
- AR/VR developers, spatial UI designers, location strategists

**Product** (4 agents)
- Product strategists, feature owners, roadmap planners

**Specialized** (14 agents)
- AI/ML specialists, blockchain developers, data engineers, and more

### Strategy Guides (3)
- EXECUTIVE-BRIEF.md: High-level organizational strategy
- QUICKSTART.md: Fast implementation guide
- nexus-strategy.md: Comprehensive strategic framework

---

## Skill Inventory

### Development (40 skills)
Git workflows, testing frameworks, database queries, API design, performance optimization, containerization, CI/CD pipelines, framework-specific patterns

### Design (5 skills)
UI components, layout systems, design tokens, accessibility, responsive design

### Creative (6 skills)
Copywriting, storytelling, prompt engineering, content planning, visual narrative

### Documents (4 skills)
Markdown formatting, technical writing, documentation structure, README best practices

### Meta (7 skills)
Code analysis, codebase exploration, configuration management, task organization, session management

---

## Workflows

### Core Workflows (15)
- **brainstorm**: Ideation and concept exploration
- **plan**: Project planning and breakdown
- **create**: Implementation and building
- **test**: Testing and validation
- **debug**: Troubleshooting and fixing
- **deploy**: Release and deployment
- **preview**: Feature previews and demos
- **enhance**: Optimization and iteration
- **status**: Progress reporting and updates
- **local-development**: Local setup and development
- **canvas-scale**: Scaling from prototype to production
- **orchestrate**: Multi-agent coordination
- **link-agent**: Agent integration and communication
- **ui-ux-pro-max**: Design system workflow
- **story-grid-workflow**: Narrative and story structure

### Strategy Workflows (2)
- Strategic planning and execution processes

---

## Integrations

Each integration folder contains:
- Configuration templates
- Authentication setup guides
- Tool-specific prompts
- Best practices and workarounds

Supported tools:
- **claude-code**: Anthropic's official CLI
- **aider**: AI pair programming in the terminal
- **cursor**: IDE with built-in AI
- **windsurf**: Codeium's IDE
- **github-copilot**: GitHub's code completion
- **opencode**: Open-source code generation
- **gemini-cli**: Google Gemini command-line interface
- **mcp-memory**: Model Context Protocol for persistent memory

---

## Rules

### GLOBAL_RULES.md
Universal coding standards, naming conventions, and constraints that apply across all projects. These are copied into new projects during initialization.

### GEMINI.md
Tool-specific guidelines for projects using Google's Gemini models.

---

## Templates

### app-scaffolds/
Framework-specific boilerplate for:
- Web frameworks (React, Vue, Svelte, Next.js, etc.)
- Backend frameworks (Django, FastAPI, Express, etc.)
- Mobile frameworks (Flutter, React Native, etc.)
- Game engines (Godot, Unity, Unreal Engine scaffolds)

### three-file-system/
A minimal three-file starter:
1. A foundational task/goal description
2. A progress tracker
3. A configuration file

Ideal for small scripts, utilities, or microprojects.

---

## Docs

### examples/
Working code samples demonstrating:
- Common patterns
- Integration examples
- Best practices in context

### guides/
Procedural documentation:
- Setup instructions
- Configuration guides
- Troubleshooting

### prompts/
Reusable prompt templates:
- Role prompts
- Task templates
- Few-shot examples

---

## Strategy

### playbooks/
Go-to-market and operational procedures:
- Launch planning
- Team scaling
- Customer acquisition
- Retention and growth

### runbooks/
Repeatable operational procedures:
- Incident response
- Deployment procedures
- Maintenance schedules
- On-call rotation

---

## Reference Projects

### ai-intel-agent/
A complete, production-grade reference implementation demonstrating:
- Full project structure
- Integration of multiple agents and skills
- Real workflow implementation
- Testing and deployment patterns

Use this as a blueprint for complex projects.

---

## Source of Truth

### Why No Duplication?

In a traditional monolithic library, teams often copy entire directories into their projects. This creates:
- **Drift**: A fix in the library doesn't automatically update copies in 50 projects
- **Bloat**: Every project carries components it doesn't need
- **Sync burden**: Maintaining consistency across copies is manual and error-prone

### Deduplication Strategy

MASTER-LIBRARY is the **single source of truth**. New projects:

1. **Start with APP-TEMPLATE**—a minimal, version-controlled scaffold that never changes

2. **Run init.sh** (if provided)—which intelligently pulls components:
   ```bash
   init.sh pulls:
   - project type (web app, CLI tool, game, etc.)
   - required agents
   - relevant skills
   - needed workflows
   - applicable rules

   Into a new project folder, with references to MASTER-LIBRARY
   ```

3. **Reference, don't copy**: Skills and agents are symlinked or referenced, not duplicated

4. **Update once**: A fix or improvement to a skill in MASTER-LIBRARY automatically improves all projects using it

### When to Use MASTER-LIBRARY

- **New projects**: Start with APP-TEMPLATE + init.sh
- **Shared teams**: Reference agents and skills from MASTER-LIBRARY for consistency
- **Framework updates**: Update skills in MASTER-LIBRARY; all projects benefit
- **Best practices**: Add new patterns to MASTER-LIBRARY; future projects inherit them

### Project-Specific Overrides

Projects can still customize:
- Create project-specific agents in `agents/local/`
- Add project rules in `rules/PROJECT_RULES.md`
- Override skills if needed (but document why)

The key: **Keep MASTER-LIBRARY clean and general. Keep project folders focused and lean.**

---

## Getting Started

### For New Projects

```bash
# Copy the template
cp -r APP-TEMPLATE my-new-project
cd my-new-project

# Run initialization (if available)
./init.sh

# Or manually select components from MASTER-LIBRARY
```

### For Teams

1. Keep MASTER-LIBRARY as a read-only reference
2. Each project uses APP-TEMPLATE as its starting point
3. Share improvements back to MASTER-LIBRARY
4. Use version control to track which version of components each project depends on

### For Maintenance

- **Regular audits**: Are all agents in core/ still used?
- **Consolidation**: Merge similar domain agents when possible
- **Deprecation**: Mark obsolete components, remove after 2 versions
- **Testing**: Verify that skills work with all integrated tools

---

## License & Attribution

All components in MASTER-LIBRARY are designed for internal use and team collaboration. Review licensing for any third-party integrations or reference code.
