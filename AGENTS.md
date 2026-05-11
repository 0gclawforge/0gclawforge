# 0GClawForge Agent Orchestration

## Skill Triggers -> Auto-routing

| User says... | Routes to skill |
|---|---|
| "upload * to 0G", "store * permanently" | 0g-storage |
| "ask AI", "query 0G compute", "TEE inference" | 0g-compute |
| "deploy contract", "send transaction" | 0g-chain |
| "mint agent", "create iNFT" | 0g-inft |
| "remember this", "save to memory", "what did you learn" | 0g-memory |
| "launch swarm", "coordinate agents", "run workers" | swarm-orchestrator |

## Multi-step Workflows

### Forge Agent
1. 0g-compute: Generate agent personality/skills from user description
2. 0g-storage: Upload encrypted intelligence blob
3. 0g-inft: Mint ERC-7857 token with storage URI
4. 0g-memory: Initialize empty memory index

### Run Swarm Task
1. swarm-orchestrator: Decompose task with supervisor
2. 0g-compute: Execute parallel worker queries
3. 0g-memory: Record learnings for each agent
4. 0g-inft: Update iNFT metadata with new memory root hash

### Transfer Agent
1. 0g-compute: Re-encrypt intelligence for new owner (TEE)
2. 0g-storage: Upload re-encrypted blob
3. 0g-inft: Call secureTransfer() with oracle proof

## Agent Roles
- **Supervisor**: Task decomposition, result synthesis
- **Researcher**: Information gathering, summarization
- **Analyst**: Pattern recognition, data analysis
- **Writer**: Report generation, communication
