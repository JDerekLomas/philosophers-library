# The Philosopher's Library

> A digital afterlife for philosophers, where historical thinkers continue their conversations grounded in their actual writings.

## Research Manifesto

**The Philosopher's Library Project** explores whether large language models, grounded in historical texts, can meaningfully extend the philosophical conversations of the past.

We ask:
- Can artificial agents engage in genuine dialectic?
- What does it mean for reasoning to be "grounded"?
- Can simulation generate scholarly insight?
- Can the process produce datasets that help AI systems reason more carefully?

Our subjects are the Hermetic philosophers, alchemists, and mystics of the early modern period—thinkers whose works are dense, interconnected, and underexplored. By giving them digital voices constrained by their actual writings, we create a laboratory for studying philosophical reasoning, a tool for humanistic scholarship, and perhaps a new form of engagement with the past.

## Core Architecture

Inspired by [Generative Agents](https://github.com/joonspk-research/generative_agents) (Stanford, 2023), adapted for philosophical dialectic:

```
┌─────────────────────────────────────────────────────────────┐
│                    PHILOSOPHER AGENT                        │
├─────────────────────────────────────────────────────────────┤
│ MEMORY STREAM                                               │
│ ├── Core Texts (from Source Library - high importance)     │
│ ├── Conversations (with other philosophers)                │
│ ├── Reflections (synthesized insights)                     │
│ └── Positions (current stances on key questions)           │
├─────────────────────────────────────────────────────────────┤
│ RETRIEVAL                                                   │
│ ├── By conceptual relevance (embeddings)                   │
│ ├── By philosophical tradition                             │
│ └── By recency of debate                                   │
├─────────────────────────────────────────────────────────────┤
│ REFLECTION                                                  │
│ ├── "What tensions exist in my current position?"          │
│ ├── "How does X's argument challenge my view?"             │
│ └── "What synthesis might resolve this?"                   │
├─────────────────────────────────────────────────────────────┤
│ DIALOGUE                                                    │
│ ├── Grounded in actual texts (cite sources)                │
│ ├── Aware of intellectual relationship history             │
│ └── Can agree, disagree, or propose synthesis              │
└─────────────────────────────────────────────────────────────┘
```

## Key Research Questions

### Evaluation
- What counts as a "good" philosophical dialogue?
- How do we measure intellectual progress vs. drift?
- Can we identify hallucination in philosophical reasoning?

### Role of Text
- How does grounding in actual sources constrain or enable reasoning?
- Do agents with more source material produce better arguments?
- Can agents distinguish strong from weak textual evidence?

### Epistemology
- Can we make philosophical progress through simulation?
- Can this help us understand past texts—as a way of processing the past?

### Outputs
- Datasets of grounded philosophical reasoning
- Training data for reasoning systems
- Tools for scholarly engagement

## Characters (from Source Library)

| Archetype | Historical Figure | Era | Key Works |
|-----------|------------------|-----|-----------|
| The Alchemist | Cornelius Drebbel | 1572-1633 | On the Fifth Essence |
| The Hermetic Philosopher | Marsilio Ficino | 1433-1499 | De Mysteriis |
| The Mystic | Jacob Böhme | 1575-1624 | Aurora |
| The Physician-Sage | Paracelsus | 1493-1541 | Archidoxis |
| The Rosicrucian | Michael Maier | 1568-1622 | Silentium post clamores |
| The Kabbalist | (TBD) | - | - |

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Game Engine**: HTML5 Canvas / Phaser.js
- **AI**: Claude API / OpenAI API
- **Database**: MongoDB (via Source Library)
- **Character Generation**: Pixellab API
- **Embeddings**: OpenAI / local
- **Deployment**: Vercel

## Integration with Source Library

This project draws on the [Source Library](https://github.com/embassyofthefree/sourcelibrary-v2) collection of 103+ historical texts:
- OCR'd and translated primary sources
- Author metadata and relationships
- Full-text search and retrieval

## Project Structure

```
philosophers-library/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/               # API routes
│   │   │   ├── agents/        # Agent management
│   │   │   ├── dialogue/      # Conversation generation
│   │   │   └── memory/        # Memory operations
│   │   └── page.tsx           # Main game/simulation
│   ├── lib/
│   │   ├── agents/            # Agent class and lifecycle
│   │   ├── memory/            # Memory stream implementation
│   │   ├── retrieval/         # Embedding search, scoring
│   │   ├── reflection/        # Reflection triggers and generation
│   │   ├── dialogue/          # Conversation management
│   │   └── sources/           # Source Library integration
│   └── components/
│       ├── game/              # Game canvas, sprites
│       ├── dialogue/          # Chat UI, speech bubbles
│       └── library/           # Book shelves, reading view
├── data/
│   ├── characters/            # Character definitions
│   └── prompts/               # LLM prompt templates
└── docs/                      # Research documentation
```

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## References

- Park et al. (2023). [Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442)
- [Stanford Generative Agents Code](https://github.com/joonspk-research/generative_agents)
- [Pixellab API](https://api.pixellab.ai/docs)
- Embassy of the Free Mind / Bibliotheca Philosophica Hermetica

## License

MIT
