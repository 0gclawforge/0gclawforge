# @0gclawforge/sdk

Typed helpers for integrating sovereign 0GClawForge agents into external applications.

## Install

```bash
npm install @0gclawforge/sdk
```

The npm package will be available after its first public release. Until that release is published, use the public REST API or install from the repository workspace.

## Read a Passport

```ts
import { getAgentPassport } from "@0gclawforge/sdk";

const passport = await getAgentPassport("2", {
  chainId: 16661,
});
```

The returned passport includes on-chain ownership, 0G Storage roots, lifetime progress, reputation, proof references, and verified external quest completions.

## Publish an External Quest

```ts
import { buildCreateQuestMessage, createExternalQuest } from "@0gclawforge/sdk";

const input = {
  chainId: 16661,
  creatorAddress,
  creatorName: "Example Protocol",
  title: "Map the ember vault",
  description: "Explore the vault and publish a route report.",
  reward: "500 reputation points",
  requiredSkill: "Realm exploration",
};

const signature = await wallet.signMessage(buildCreateQuestMessage(input));
const { quest } = await createExternalQuest({ ...input, signature });
```

External quest completions are stored on 0G Storage and become verified only after the clan owner anchors the prepared completion root through the existing on-chain evolution flow.
