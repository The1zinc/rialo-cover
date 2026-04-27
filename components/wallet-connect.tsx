"use client";

import { Loader2, LogOut, Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { Button } from "@/components/ui/button";
import { shortenAddress } from "@/lib/policy";

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const connector = connectors[0];

  if (isConnected && address) {
    return (
      <Button variant="secondary" onClick={() => disconnect()} className="gap-2">
        <span className="hidden sm:inline">{shortenAddress(address)}</span>
        <LogOut className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button disabled={!connector || isPending} onClick={() => connector && connect({ connector })} className="gap-2">
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
      <span className="hidden sm:inline">Connect Wallet</span>
    </Button>
  );
}
