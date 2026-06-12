export const OG_MAINNET_CHAIN_ID = 16661;

export interface MainnetGasClaimMessageInput {
  address: string;
  issuedAt: number;
}

export function buildMainnetGasClaimMessage(input: MainnetGasClaimMessageInput) {
  return [
    "0GClawForge Mainnet Gas Station",
    "Action: claim",
    `Chain ID: ${OG_MAINNET_CHAIN_ID}`,
    `Recipient: ${input.address.toLowerCase()}`,
    `Issued At: ${input.issuedAt}`,
  ].join("\n");
}
