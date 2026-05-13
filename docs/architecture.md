# 0GClawForge Architecture

0GClawForge is the first complete OpenClaw-powered sovereign agent OS — a forge where teams mint, orchestrate, own (as ERC-7857 iNFTs), persist, and evolve multi-agent systems that run verifiable TEE inference, store long-term memory forever on 0G, and execute autonomous on-chain actions with zero context loss. Built on top, Eternal Clans is the flagship consumer application: tradable AI civilizations where players co-create UGC Gaming realms + SocialFi DAOs + DePIN coordination into one living, self-evolving digital nation.

## Product Boundary

The MVP is intentionally limited to the four pillars:

- 0G Storage permanent memory plus 0G Compute TEE inference.
- ERC-7857 ownership of full clan systems as one iNFT.
- OpenClaw UGC realm generation stored on 0G.
- Autonomous evolution, trade, and community votes for evolution.

SocialFi auto-deploy, DePIN coordination, in-realm quests, and messaging bots are Phase 2 placeholders only.

## Layers

- `os-core/`: composes runtime network config, permanent memory, and verifiable inference.
- `storage/`: typed 0G Storage memory/log wrapper.
- `compute/`: typed 0G TEE inference wrapper.
- `agents/`: OpenClaw-style realm generation, proposal, vote, and evolution logic.
- `clans-app/`: Eternal Clans app state transitions on top of the OS.
- `packages/contracts/`: ERC-7857 iNFT, marketplace, registry, mock oracle.
- `apps/dashboard/`: focused five-tab MVP UI.

## Data Flow

1. Clan mint plan is generated through `SovereignAgentOS`.
2. Intelligence and memory indexes are committed to 0G Storage.
3. The whole clan is minted as one ERC-7857 iNFT through `AgentINFT.mintClan`.
4. UGC realm prompts are converted into realm specs and committed to 0G Storage.
5. Community vote roots are stored on 0G and linked to the clan token.
6. Winning proposals trigger TEE-verified evolution and update memory/realm roots.
7. Trade uses secure transfer so the buyer inherits memory, realms, votes, and intelligence history.
