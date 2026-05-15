import { GameEngine } from "./GameEngine";

export default function PlayRealmTokenPage({ params }: { params: { tokenId: string } }) {
  return <GameEngine tokenId={params.tokenId} />;
}
