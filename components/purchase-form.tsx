"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, PlaneTakeoff } from "lucide-react";
import { parseEther } from "viem";
import { toast } from "sonner";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RIALO_COVER_ABI, RIALO_COVER_ADDRESS, isContractConfigured } from "@/lib/contract";
import { normalizeFlightNumber } from "@/lib/policy";

export function PurchaseForm() {
  const { isConnected } = useAccount();
  const [flightNumber, setFlightNumber] = useState("UA100");
  const [premium, setPremium] = useState(0.03);
  const { data: hash, error, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const payout = useMemo(() => premium * 5, [premium]);
  const disabled = !isConnected || !isContractConfigured || isPending || isConfirming;

  useEffect(() => {
    if (error) {
      toast.error("Purchase failed", { description: error.message });
    }
  }, [error]);

  useEffect(() => {
    if (isSuccess) {
      toast.success("Policy purchased", { description: "Your policy is now stored on-chain." });
    }
  }, [isSuccess]);

  function handleBuyPolicy() {
    const normalized = normalizeFlightNumber(flightNumber);
    if (!normalized) {
      toast.error("Enter a valid flight number", { description: "Use 2-12 letters, numbers, or hyphens." });
      return;
    }

    if (!RIALO_COVER_ADDRESS) {
      toast.error("Contract not configured", { description: "Set NEXT_PUBLIC_RIALO_COVER_CONTRACT after deploying." });
      return;
    }

    writeContract({
      address: RIALO_COVER_ADDRESS,
      abi: RIALO_COVER_ABI,
      functionName: "buyPolicy",
      args: [normalized],
      value: parseEther(premium.toFixed(4)),
    });
  }

  return (
    <Card className="overflow-hidden border-white/10 bg-card/80 shadow-glow backdrop-blur">
      <CardHeader>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <PlaneTakeoff className="h-6 w-6" />
        </div>
        <CardTitle className="text-3xl">Buy flight cover</CardTitle>
        <CardDescription>Pick a flight, stake a premium, and let the contract verify the outcome.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isContractConfigured ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            Contract address is not configured. Deploy the intelligent contract, then set <code>NEXT_PUBLIC_RIALO_COVER_CONTRACT</code>.
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="flightNumber">Flight number</Label>
          <Input
            id="flightNumber"
            value={flightNumber}
            onChange={(event) => setFlightNumber(event.target.value.toUpperCase())}
            placeholder="UA100"
            maxLength={12}
          />
        </div>

        <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="premium">Premium</Label>
              <p className="text-sm text-muted-foreground">Minimum 0.01 native token</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black">{premium.toFixed(2)}</p>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">premium</p>
            </div>
          </div>
          <input
            id="premium"
            type="range"
            min="0.01"
            max="0.2"
            step="0.01"
            value={premium}
            onChange={(event) => setPremium(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
          />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-secondary p-3">
              <p className="text-muted-foreground">Potential payout</p>
              <p className="mt-1 text-lg font-bold">{payout.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl bg-secondary p-3">
              <p className="text-muted-foreground">Trigger</p>
              <p className="mt-1 text-lg font-bold">Delayed or cancelled</p>
            </div>
          </div>
        </div>

        <Button onClick={handleBuyPolicy} disabled={disabled} className="w-full" size="lg">
          {isPending || isConfirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {!isConnected ? "Connect wallet to buy" : isConfirming ? "Confirming policy" : "Buy Policy"}
        </Button>
      </CardContent>
    </Card>
  );
}
