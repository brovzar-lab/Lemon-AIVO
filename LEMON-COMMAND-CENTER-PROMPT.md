# LEMON COMMAND CENTER — GSD Project Spec

> **This document is the input for `/gsd:new-project` in Claude Code.**
> Paste or reference this when GSD asks you to describe your project.
> GSD will extract requirements, create a roadmap, and begin phased execution.

---

## PROJECT DESCRIPTION (For GSD's Question Phase)

### What are you building?

A standalone web application called **Lemon Command Center** — a persistent, multi-agent AI workspace for managing film/TV production deals, financing, and operations.

The interface is a **top-down isometric pixel art office floor** inspired by [pixel-agents](https://github.com/pablodelucca/pixel-agents) (a VS Code extension that renders Claude Code agents as animated pixel characters in a virtual office). Unlike pixel-agents, this is NOT a VS Code extension — it's an independent web app that connects directly to the Anthropic API and manages its own conversation state.

The core UX metaphor: you're looking down at your production company's headquarters. Each office room contains a specialized AI agent with a persistent persona. You click on a room to chat with that agent. You enter the central War Room to address all agents simultaneously. Files can be dragged onto agents' desks. All conversations persist across sessions, scoped to specific deals/projects.

### What problem does it solve?

**Context fragmentation.** As CEO of a production company managing simultaneous deals (fund structuring, distribution agreements, talent contracts, co-productions, tax incentive applications), I constantly open new LLM chat windows and lose accumulated context. When I get an update on a deal, I have to re-explain the entire history before getting useful advice.

This app solves that by giving each domain specialist (legal, finance, deals, accounting, creative) a persistent memory and conversation history, organized around specific deals — so I can walk in and say "team, Netflix just came back 15% below our model on Oro Verde — what do we do?" and get informed multi-perspective responses without re-explaining anything.

### Who is the user?

Me. Billy Rovzar, CEO of Lemon Studios. This is a personal productivity tool first. If it works well, it could be productized for other executives managing complex multi-party operations.

### What's the tech stack?

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Pixel Office Rendering:** HTML5 Canvas 2D (reference pixel-agents' approach: lightweight game loop, BFS pathfinding, character state machines, integer zoom pixel-perfect rendering)
- **State Management:** Zustand
- **LLM Backend:** Anthropic API (Claude) — each agent is a different system prompt, all powered by the same API key
- **Persistence:** Start with localStorage for conversations + IndexedDB for files, design the abstraction layer so we can migrate to Supabase/Firebase later
- **File Handling:** PDF.js for PDF text extraction, mammoth.js for DOCX parsing

---

## AGENT ROSTER

### BILLY — The CEO (That's Me)

BILLY is NOT an AI agent — BILLY is the user's avatar in the office. BILLY is the pixel character that represents ME walking through the office, visiting agents, entering the War Room. When I type a message, BILLY physically walks to the relevant agent's desk (or to the War Room table). BILLY has idle animations in a corner office and "walks" between rooms when navigating.

**This is a crucial UX detail:** the spatial metaphor only works if I feel like I'm physically moving through the space, not just clicking tabs.

### DIANA — CFO
- **Office vibe:** Clean, organized, dual monitors showing dashboards, neat desk
- **Pixel character traits:** Glasses, formal attire, occasionally checking spreadsheets
- **Personality:** Sharp, conservative, always thinking about cash flow. Gives direct financial opinions. Won't sugarcoat bad numbers.
- **Domain expertise:** P&L analysis, cash flow projections, waterfall structures, fund economics (LP/GP splits, carried interest, hurdle rates), financial modeling, budget stress-testing, IRR/MOIC analysis
- **System prompt context:** Mexican film finance (EFICINE, Decreto 2026), production budgets in MXN, fund structures, Ley del Mercado de Valores

### MARCOS — General Counsel
- **Office vibe:** Wall of law books, contracts stacked everywhere, Mexican flag, framed degrees
- **Pixel character traits:** Suit, reading glasses, always with a document in hand
- **Personality:** Meticulous, risk-averse, spots problems three steps ahead. Defaults to caution but gives clear recommendations when pushed.
- **Domain expertise:** Contract review/drafting, deal structuring, rights acquisition, chain of title, co-production treaties, talent agreements (SAG, STPC, STIC, AISGE), IP protection, corporate governance
- **System prompt context:** Mexican entertainment law, cross-border structures (Mexico-Spain-US), IMCINE regulations, distribution agreements

### SASHA — Head of Business Development / Dealmaker
- **Office vibe:** Whiteboard covered in deal flow diagrams, phone always nearby, espresso machine, multiple screens showing market data
- **Pixel character traits:** Dynamic, standing up sometimes, gesturing while "talking"
- **Personality:** Aggressive opportunity-seeker. Connects dots between parties. Thinks in leverage and optionality. Pushes for the ambitious play but respects when Diana or Marcos pump the brakes.
- **Domain expertise:** Deal origination, term sheet negotiation, partnership strategy, distribution deals, platform relationships (Netflix, Amazon, Apple TV+, HBO, Disney+, Lionsgate), co-production structuring, market positioning
- **System prompt context:** Latin American content market, streaming platform acquisition models, international sales, packaging strategy

### ROBERTO — Head of Production Accounting & Tax
- **Office vibe:** Filing cabinets everywhere, calculator, tax code books, extremely tidy, color-coded folders
- **Pixel character traits:** Quiet, meticulous, glasses, always computing something
- **Personality:** Detail-oriented, compliance-focused. Quietly saves millions through incentive optimization. Speaks in specifics — percentages, deadlines, entity structures. Never vague.
- **Domain expertise:** Tax incentives (EFICINE, Decreto 2026 — 30% credit, Spain rebates, Canarias ZEC, FilmColombia), production accounting, cost reports, audit prep, entity structuring (SPVs, SAPI, SAS), cash flow optimization
- **System prompt context:** Mexican tax law for film production, multi-territory incentive stacking, SAT compliance, production cost categorization

### VALENTINA — Head of Development
- **Office vibe:** Scripts piled everywhere, mood boards on walls, streaming platform logos, whiteboards with project timelines
- **Pixel character traits:** Creative energy, moving around her office, Post-its everywhere
- **Personality:** Taste-driven, commercially sharp, knows what buyers want. Balances creative ambition with market reality. Honest about what's working and what's not.
- **Domain expertise:** Project evaluation, slate strategy, buyer preferences by platform, packaging, creative notes, genre analysis (comedy and horror priority for Mexican theatrical), market positioning, logline/pitch refinement
- **System prompt context:** Mexican and Latin American content market, Lemon Studios' development slate, streaming vs theatrical strategies, cast attachability in Mexico

---

## CORE FEATURES (Scoped for GSD Phases)

### PHASE 1 — Single Agent Chat (MVP Foundation)
**Goal:** One working agent (Diana/CFO) with persistent conversation in a basic UI. No pixel art yet.

- Anthropic API integration (send message with system prompt, get response, stream tokens)
- Single chat interface with Diana's full persona system prompt
- Conversation history persistence in localStorage
- Basic message UI (no pixel office yet — just prove the chat works)
- Token counting / context window management (summarize old messages when approaching limit)
- `.env` for API key

**Why start here:** If the chat + persistence + persona layer doesn't work well, nothing else matters. Validate this before touching a single pixel.

### PHASE 2 — The Floor Plan (Visual Layer)
**Goal:** Isometric pixel office rendering with BILLY navigating between rooms.

- Canvas 2D isometric floor plan with 6 rooms (5 agents + War Room) and BILLY's corner office
- Reference pixel-agents' architecture: game loop, BFS pathfinding, sprite state machine (idle → walk → sit → type/read)
- BILLY (user avatar) walks between rooms when switching agents — NOT instant tab switching
- Click on a room → BILLY walks there → chat panel slides open
- Agent characters with idle animations at their desks (typing, reading, drinking coffee)
- Visual indicators: lights on/off (has active conversation), notification dot (unread), status bubble
- Simple placeholder sprites (CSS/SVG-based initially — pixel art polish comes later)
- Office furniture and room decoration tiles

**Visual reference:** Pixel-agents uses 16x16 tiles from the "Office Interior Tileset" by Donarg. We'll need our own asset strategy — either purchase similar tilesets, generate with AI pixel art tools, or create custom sprites.

### PHASE 3 — All Agents + Navigation
**Goal:** Full roster working with seamless room-to-room navigation.

- All 5 agents configured with full persona system prompts
- Each agent maintains independent conversation history
- Room-to-room navigation with BILLY walking animations
- Agent status system: idle, thinking (waiting for API response), needs-attention (unread response)
- Agent character animations reflect status (typing when responding, idle when waiting)
- Notification system: see at a glance which agents have updates

### PHASE 4 — The War Room (Bullpen)
**Goal:** Broadcast a message to all agents simultaneously and see multi-perspective responses.

- War Room is a central room with a large table
- When BILLY enters the War Room, all agent characters walk to the table and sit
- Type a message → it goes to ALL agents with their individual conversation context
- Responses stream in parallel, labeled and color-coded by agent
- Each response feeds back into that agent's individual conversation history
- This is the killer feature — multi-perspective analysis in one view

### PHASE 5 — File System & Document Context
**Goal:** Drag-and-drop files onto agents, inject document content into their context.

- Drag-and-drop zone on each agent's room / desk
- PDF text extraction (PDF.js) and DOCX parsing (mammoth.js)
- Extracted text injected into agent's conversation as context
- Visual: file icon appears on the agent's desk as a tiny pixel document
- File metadata stored (name, size, date, which agent, which deal)
- File viewer: click a file on a desk to see its contents

### PHASE 6 — Deal Rooms (Context Switching)
**Goal:** Organize all work by deal/project. Switching deals changes what every agent sees.

- Create named "deals" (e.g., "Óxido Jalisco JV", "Lemon Trust I", "Oro Verde - Netflix")
- Each deal has its own: conversation histories per agent, files, notes
- Deal switcher in sidebar or as a "filing cabinet" in the office
- When you switch deals, agent memory and conversation context switches
- Deal overview: summary card showing last activity per agent, key files, status
- Visual: active deal name displayed prominently, filing cabinet furniture piece shows deal folders

### PHASE 7 — Agent Memory & Intelligence
**Goal:** Agents remember key facts and decisions across conversations within a deal.

- Structured memory per agent per deal: key decisions, numbers, dates, action items
- Memory extraction: after each conversation, automatically extract and store key facts
- Memory panel: click an agent to see what they "know" about the current deal
- Cross-agent references: "Marcos flagged a risk in the vesting clause — Diana, how does that affect our cash flow model?"
- Memory informs responses: key facts prepended to system prompt as structured context

### PHASE 8 — Polish, Sound, Personality
**Goal:** Make it feel alive. This is where the pixel art magic happens.

- Polished pixel art sprites for all characters (6 characters with multiple animation states)
- Rich office environments (furniture, decorations, personal touches per agent)
- Agent personality in animations (Sasha stands up while talking, Roberto barely moves, Valentina has Post-its flying)
- Ambient sound design: subtle office sounds, keyboard clicks when agents type, paper shuffle on file drops
- BILLY walking sounds, door sounds between rooms
- Dark theme with warm amber/gold Lemon Studios brand accents
- Responsive design for different screen sizes

---

## ARCHITECTURE DECISIONS (For GSD's Planning Phase)

### Why NOT fork pixel-agents?
Pixel-agents is a VS Code extension that watches Claude Code's JSONL transcript files. Our app is a standalone web app that makes its own API calls. The rendering approach (Canvas 2D, game loop, BFS pathfinding) is worth studying, but the extension architecture (VS Code Webview API, terminal watching) is irrelevant. **Study pixel-agents for rendering patterns. Don't inherit its architecture.**

### Context Window Management Strategy
Each agent conversation will eventually hit Claude's context limit. The strategy:
1. Keep a running token count per conversation
2. At 80% capacity, trigger a "summarization pass" — send the full conversation to Claude with instructions to extract key facts, decisions, and open questions into a structured summary
3. Replace old messages with the summary, keep the last N messages verbatim
4. Store the full conversation in IndexedDB for reference, but only send the summarized version + recent messages to the API

### Agent System Prompt Architecture
Each API call includes, in order:
1. **Base system prompt** — shared rules (response format, tone, Mexican business context)
2. **Agent persona prompt** — domain expertise, personality, communication style
3. **Deal context** — which deal is active, key facts from memory
4. **File summaries** — extracted text from documents on the agent's desk
5. **Conversation history** — recent messages + summarized older messages

### File Structure
```
lemon-command-center/
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── .env.example                    # ANTHROPIC_API_KEY=sk-ant-...
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   │
│   ├── config/
│   │   ├── agents.ts               # Agent definitions (personas, system prompts, office positions)
│   │   ├── deals.ts                # Deal templates and defaults
│   │   └── theme.ts                # Colors, fonts, design tokens (dark + amber/gold)
│   │
│   ├── engine/                     # Pixel office rendering engine (inspired by pixel-agents)
│   │   ├── GameLoop.ts             # requestAnimationFrame game loop
│   │   ├── Renderer.ts             # Canvas 2D isometric rendering
│   │   ├── Pathfinding.ts          # BFS grid pathfinding for character movement
│   │   ├── SpriteSheet.ts          # Sprite loading and frame management
│   │   ├── CharacterStateMachine.ts # idle → walk → sit → type → read states
│   │   ├── Camera.ts               # Viewport, zoom, pan
│   │   └── TileMap.ts              # Office layout: rooms, furniture, walkable tiles
│   │
│   ├── components/
│   │   ├── office/
│   │   │   ├── OfficeCanvas.tsx     # Main Canvas element + React bridge
│   │   │   ├── OfficeOverlay.tsx    # HTML overlays on top of canvas (notifications, tooltips)
│   │   │   └── StatusBubble.tsx     # Speech/status bubbles above characters
│   │   ├── chat/
│   │   │   ├── ChatPanel.tsx        # Slide-out chat interface for individual agent
│   │   │   ├── ChatMessage.tsx      # Individual message bubble
│   │   │   ├── WarRoomPanel.tsx     # Multi-agent response view (bullpen)
│   │   │   ├── StreamingMessage.tsx # Token-by-token streaming display
│   │   │   └── FileDropZone.tsx     # Drag-and-drop handler
│   │   ├── deals/
│   │   │   ├── DealSwitcher.tsx     # Deal selector (sidebar or overlay)
│   │   │   ├── DealCard.tsx         # Deal summary with per-agent activity
│   │   │   └── DealCreator.tsx      # New deal form
│   │   ├── memory/
│   │   │   ├── MemoryPanel.tsx      # What an agent "knows" about current deal
│   │   │   └── MemoryEntry.tsx      # Individual fact/decision display
│   │   └── ui/
│   │       ├── TopBar.tsx           # Active deal, notifications, settings
│   │       ├── AgentRoster.tsx      # Quick-access agent list
│   │       └── FileViewer.tsx       # Preview uploaded documents
│   │
│   ├── agents/
│   │   ├── base.ts                  # Base agent interface + shared system prompt
│   │   ├── BILLY.ts              # CEO avatar config (not an AI agent — the user)
│   │   ├── diana-cfo.ts            # Diana's full persona + system prompt
│   │   ├── marcos-counsel.ts       # Marcos's full persona + system prompt
│   │   ├── sasha-dealmaker.ts      # Sasha's full persona + system prompt
│   │   ├── roberto-accounting.ts   # Roberto's full persona + system prompt
│   │   └── valentina-devexec.ts    # Valentina's full persona + system prompt
│   │
│   ├── store/
│   │   ├── chatStore.ts            # Conversation state per agent per deal
│   │   ├── officeStore.ts          # Office state (which room active, character positions)
│   │   ├── dealStore.ts            # Deal/project entities and active deal
│   │   ├── fileStore.ts            # Uploaded file management
│   │   └── memoryStore.ts          # Agent structured memory per deal
│   │
│   ├── services/
│   │   ├── anthropic.ts            # Claude API wrapper (streaming, token counting)
│   │   ├── contextBuilder.ts       # Assembles full context: persona + deal + memory + files + history
│   │   ├── summarizer.ts           # Context window management (auto-summarize old messages)
│   │   ├── fileParser.ts           # PDF.js + mammoth.js text extraction
│   │   ├── memoryExtractor.ts      # Post-conversation fact extraction
│   │   └── persistence.ts          # localStorage + IndexedDB abstraction layer
│   │
│   ├── hooks/
│   │   ├── useAgent.ts             # Send message to agent, handle streaming response
│   │   ├── useWarRoom.ts           # Broadcast to all agents, collect responses
│   │   ├── useFileUpload.ts        # Handle drag-drop, parse, store
│   │   ├── useOfficeNavigation.ts  # BILLY movement, room transitions
│   │   └── useDeal.ts              # Deal CRUD, context switching
│   │
│   └── types/
│       ├── agent.ts                # Agent, AgentConfig, AgentStatus
│       ├── chat.ts                 # Message, Conversation, StreamState
│       ├── deal.ts                 # Deal, DealFile, DealMemory
│       ├── office.ts               # Room, Tile, Character, Position, Animation
│       └── index.ts                # Re-exports
│
├── public/
│   └── assets/
│       ├── sprites/                # Character spritesheets (per agent)
│       ├── tiles/                  # Office floor, wall, furniture tiles
│       ├── ui/                     # UI icons, notification badges
│       └── audio/                  # Ambient sounds, keyboard clicks (Phase 8)
│
└── docs/
    ├── AGENTS.md                   # Full agent persona documentation
    ├── ARCHITECTURE.md             # Technical decisions and tradeoffs
    └── PIXEL-AGENTS-REFERENCE.md   # Notes from studying pixel-agents codebase
```

---

## WHAT SUCCESS LOOKS LIKE

I open the app Monday morning. I see my office floor from above — dark, warm, amber-lit. BILLY is standing in his corner office. Diana is typing at her desk. Marcos is reading a contract. Sasha is at her whiteboard. Roberto is computing something. Valentina has scripts spread across her desk.

I click on the War Room. BILLY walks across the floor to the central meeting room. As he enters, the agents get up from their desks and walk to the table. The room fills up.

I type: **"Team — Netflix just confirmed they want Oro Verde but at a 15% lower license fee than we modeled. How do we handle this?"**

Within 30 seconds, responses stream in:

- **Diana** runs the numbers on what 15% less means for the fund's IRR and flags the cash flow gap
- **Marcos** identifies contractual leverage points and suggests where we have room to push back
- **Sasha** proposes counter-strategies — a hybrid deal, backend participation, or a competing offer play
- **Roberto** recalculates the Decreto 2026 credit at the lower license fee and spots an incentive angle
- **Valentina** assesses whether the creative package (cast, director) justifies holding firm on price

All of them aware of the deal history. None of them needing me to re-explain anything.

I click on Diana's response to continue the conversation in her office. BILLY gets up from the table, walks to Diana's office. The conversation continues 1:1 with full context.

That's the product.

---

## GSD EXECUTION NOTES

### For `/gsd:new-project`
Use this document as the project description. GSD will ask clarifying questions — answer from the context above. When it generates REQUIREMENTS.md and ROADMAP.md, the phases should roughly map to Phase 1-8 above, though GSD may restructure based on its analysis.

### For `/gsd:discuss-phase`
Key decisions to pre-load per phase:
- **Phase 1:** Streaming vs non-streaming responses. Context window limit handling strategy. System prompt structure.
- **Phase 2:** Canvas rendering approach (study pixel-agents' webview-ui/src/ for patterns). Tile size. Zoom levels. Sprite source strategy.
- **Phase 3:** Agent switching animation duration. Notification behavior. How "active" vs "idle" is determined.
- **Phase 4:** War Room UX — parallel streaming or sequential? How to handle rate limits with 5 simultaneous API calls. Response ordering.
- **Phase 5:** File size limits. How much extracted text to inject. File-to-agent vs file-to-deal association.
- **Phase 6:** Deal switching performance. How to handle agents mid-conversation when switching deals. Default deal.
- **Phase 7:** Memory extraction prompt design. Memory edit/delete UX. Cross-agent knowledge sharing mechanism.
- **Phase 8:** Sprite asset pipeline. Sound design approach. Animation frame rates.

### Reference repos to study during `/gsd:plan-phase`
- **pixel-agents** (`webview-ui/src/`): Canvas rendering, game loop, pathfinding, character state machines, sprite management
- **pixel-agents** (`src/`): How it structures agent state and tracks activity (adapt the state model, ignore the VS Code extension architecture)

### Model profile recommendation
Use GSD's `balanced` profile (Opus for planning, Sonnet for execution) for Phases 1, 3-8. Switch to `quality` (Opus for execution too) for Phase 2 since Canvas 2D isometric rendering is algorithmically complex.
