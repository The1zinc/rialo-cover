"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Loader2, ReceiptText, RotateCcw, SearchCheck } from "lucide-react";
import { formatEther } from "viem";
import { toast } from "sonner";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RIALO_COVER_ABI, RIALO_COVER_ADDRESS, isContractConfigured } from "@/lib/contract";
import { toPolicyCards, type PolicyCard } from "@/lib/policy";

function statusVariant(status: string) {
  if (["delayed", "cancelled"].includes(status)) return "success" as const;
  if (["api_error", "unknown", "pool_underfunded"].includes(status)) return "warning" as const;
  if (["refunded", "on_time"].includes(status)) return "secondary" as const;
  return "default" as const;
}

function canRefund(policy: PolicyCard) {
  return !policy.isResolved && ["api_error", "unknown", "pool_underfunded"].includes(policy.resolutionStatus);
}

export function PoliciesDashboard() {
  const { address, isConnected } = useAccount();
  const [activeAction, setActiveAction] = useState<bigint | null>(null);
  const { data, error, isLoading, refetch } = useReadContract({
    address: RIALO_COVER_ADDRESS,
    abi: RIALO_COVER_ABI,
    functionName: "getPolicies",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && RIALO_COVER_ADDRESS),
      refetchInterval: 15_000,
    },
  });
  const { data: hash, error: writeError, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const policies = useMemo(() => toPolicyCards(data), [data]);

  useEffect(() => {
    if (error) {
      toast.error("Could not load policies", { description: error.message });
    }
  }, [error]);

  useEffect(() => {
    if (writeError) {
      toast.error("Transaction failed", { description: writeError.message });
    }
  }, [writeError]);

  useEffect(() => {
    if (isSuccess) {
      toast.success("Policy updated", { description: "The latest contract state has been requested." });
      void refetch();
    }
  }, [isSuccess, refetch]);

  function verifyPolicy(policyId: bigint) {
    if (!RIALO_COVER_ADDRESS) return;
    setActiveAction(policyId);
    writeContract({
      address: RIALO_COVER_ADDRESS,
      abi: RIALO_COVER_ABI,
      functionName: "checkFlightAndPayout",
      args: [policyId],
    });
  }

  function refundPolicy(policyId: bigint) {
    if (!RIALO_COVER_ADDRESS) return;
    setActiveAction(policyId);
    writeContract({
      address: RIALO_COVER_ADDRESS,
      abi: RIALO_COVER_ABI,
      functionName: "refundUnresolvedPolicy",
      args: [policyId],
    });
  }

  return (
    <Card className="border-white/10 bg-card/70 backdrop-blur">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-3xl">
            <ReceiptText className="h-7 w-7 text-primary" />
            Active policies
          </CardTitle>
          <CardDescription>Fetched directly from the contract. No API route, database, or off-chain indexer required.</CardDescription>
        </div>
        <Button variant="secondary" onClick={() => void refetch()} disabled={!isConnected || !isContractConfigured || isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
            <CircleAlert className="h-8 w-8 text-muted-foreground" />
            <p className="mt-4 text-lg font-semibold">Connect a wallet to view policies.</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">Your wallet address is used to query policy records from the smart contract.</p>
          </div>
        ) : null}

        {isConnected && !isContractConfigured ? (
          <div className="rounded-3xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm text-amber-100">
            Set <code>NEXT_PUBLIC_RIALO_COVER_CONTRACT</code> to read and resolve policies.
          </div>
        ) : null}

        {isConnected && isContractConfigured && !isLoading && policies.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
            <p className="text-lg font-semibold">No policies found for this wallet.</p>
            <p className="mt-2 text-sm text-muted-foreground">Buy a policy above and it will appear here once the transaction is confirmed.</p>
          </div>
        ) : null}

        {policies.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {policies.map((policy) => {
              const busy = activeAction === policy.id && (isPending || isConfirming);

              return (
                <div key={policy.id.toString()} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Policy #{policy.id.toString()}</p>
                      <p className="mt-1 text-3xl font-black tracking-tight">{policy.flightNumber}</p>
                    </div>
                    <Badge variant={statusVariant(policy.resolutionStatus)}>{policy.resolutionStatus}</Badge>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-secondary p-3">
                      <p className="text-muted-foreground">Premium</p>
                      <p className="mt-1 font-bold">{Number(formatEther(policy.premiumPaid)).toFixed(4)}</p>
                    </div>
                    <div className="rounded-2xl bg-secondary p-3">
                      <p className="text-muted-foreground">Payout</p>
                      <p className="mt-1 font-bold">{Number(formatEther(policy.payoutAmount)).toFixed(4)}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="flex-1"
                      disabled={policy.isResolved || busy}
                      onClick={() => verifyPolicy(policy.id)}
                    >
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchCheck className="mr-2 h-4 w-4" />}
                      Verify Flight Status
                    </Button>
                    {canRefund(policy) ? (
                      <Button variant="secondary" disabled={busy} onClick={() => refundPolicy(policy.id)}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Refund
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
