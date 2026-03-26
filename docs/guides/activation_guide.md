# Skill Auto-Activation Guide

This guide details the patterns Antigravity uses to automatically discover and invoke skills from the `.agent/skills` directory, focusing on the `planning-with-files` skill.

## Trigger Phrases for Planning

The planning skill activates when the agent detects high-complexity tasks that require organization.

### High-Confidence Triggers
- "This is a **complex task**..."
- "**Multi-step project** requiring..."
- "I need **planning** for..."
- "**Organize** this complex..."
- "Requires **careful planning**..."
- "**Multi-phase** development..."

### Complexity Indicators
- **Component Enumeration**: Mentioning multiple layers (e.g., "frontend, backend, database").
- **Phase Descriptions**: Explicitly stating "Phase 1: Setup, Phase 2: Implementation...".
- **Quantitative Scale**: Mentioning "10+ steps" or "long-term project".

## Auto-Activation Troubleshooting

If a skill fails to activate:
1. **Append a Trigger**: Add "This is a complex multi-step project requiring planning" to the end of your prompt.
2. **Be Explicit**: List the intended phases.
3. **Session Refresh**: Some skills are indexed only at the start of a session; restarting the Antigravity session can force a rescan.

## Pro Pattern: The "State Your Intent" Prompt
Instead of saying "Build a website," use: 
*"I want to build a business website through a structured multi-step learning plan with tracking. This is a complex project requiring careful planning phases."*
