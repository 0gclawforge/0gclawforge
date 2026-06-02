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

The returned passport includes on-chain ownership, 0G Storage roots, lifetime progress, reputation, and proof references.
