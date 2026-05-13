import {
  createEvolutionProposal,
  executeWinningEvolution,
  generateRealmFromPrompt,
  voteOnProposal,
  type EvolutionExecution,
  type EvolutionProposal,
  type UGCRealm,
} from "@0gclawforge/agents";
import type { SovereignAgentOS } from "@0gclawforge/os-core";

export interface EternalClanState {
  readonly clanId: string;
  readonly name: string;
  readonly memoryRootHash: string | null;
  readonly realms: readonly UGCRealm[];
  readonly proposals: readonly EvolutionProposal[];
  readonly history: readonly string[];
}

export class EternalClansApp {
  constructor(private readonly os: SovereignAgentOS) {}

  async coCreateRealm(state: EternalClanState, prompt: string): Promise<EternalClanState> {
    const realm = await generateRealmFromPrompt(prompt, this.os.inference);
    const stored = await this.os.memory.commitRecord("realm", state.clanId, realm);
    const memory = await this.os.memory.appendClanMemory(
      state.memoryRootHash,
      state.clanId,
      `UGC REALM CREATED: ${realm.title}\nPROMPT: ${prompt}`,
      ["realm", "ugc", "openclaw"],
      0.9
    );

    return {
      ...state,
      memoryRootHash: memory.rootHash,
      realms: [...state.realms, { ...realm, storageRootHash: stored.rootHash }],
      history: [`Realm permanently stored on 0G: ${stored.rootHash}`, ...state.history],
    };
  }

  proposeEvolution(state: EternalClanState, text: string): EternalClanState {
    return {
      ...state,
      proposals: [createEvolutionProposal(state.clanId, text), ...state.proposals],
    };
  }

  vote(state: EternalClanState, proposalId: string, support: boolean): EternalClanState {
    return {
      ...state,
      proposals: state.proposals.map((proposal) =>
        proposal.id === proposalId ? voteOnProposal(proposal, support) : proposal
      ),
    };
  }

  async executeEvolution(state: EternalClanState, proposalId: string): Promise<{
    state: EternalClanState;
    execution: EvolutionExecution;
  }> {
    const proposal = state.proposals.find((item) => item.id === proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }
    const execution = await executeWinningEvolution(
      proposal,
      this.os.memory,
      state.memoryRootHash,
      this.os.inference
    );

    return {
      execution,
      state: {
        ...state,
        memoryRootHash: execution.memoryRootHash,
        realms: [...state.realms, execution.realm],
        proposals: state.proposals.map((item) => (item.id === proposalId ? execution.proposal : item)),
        history: [`Vote executed with verified OpenClaw inference: ${execution.recordRootHash}`, ...state.history],
      },
    };
  }
}
