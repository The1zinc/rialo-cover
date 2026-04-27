"use client";

import { useState } from "react";
import { Copy, Rocket, CheckCircle2, AlertCircle, Loader2, ChevronRight, Terminal } from "lucide-react";
import { toast } from "sonner";
import { useAccount, useSendTransaction } from "wagmi";
import { stringToHex } from "viem";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// The contract code we want to deploy
const CONTRACT_CODE = `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from dataclasses import dataclass
import json

from genlayer import *


DEFAULT_FLIGHT_STATUS_URL = "https://opensky-network.org/api/states/all"
MIN_PREMIUM = u256(10_000_000_000_000_000)  # 0.01 native token, 18 decimals.
MAX_FLIGHT_NUMBER_LENGTH = 12


@allow_storage
@dataclass
class Policy:
    id: u256
    userAddress: Address
    flightNumber: str
    premiumPaid: u256
    payoutAmount: u256
    isResolved: bool
    resolutionStatus: str
    lastCheckedAt: u256


def _normalize_flight_number(flight_number: str) -> str:
    normalized = flight_number.strip().upper().replace(" ", "")
    if len(normalized) < 2 or len(normalized) > MAX_FLIGHT_NUMBER_LENGTH:
        raise Exception("Invalid flight number length")

    for char in normalized:
        if not (char.isalnum() or char == "-"):
            raise Exception("Flight number may only contain letters, numbers, or hyphens")

    return normalized


def _flight_matches(value: str, flight_number: str) -> bool:
    normalized_value = value.strip().upper().replace(" ", "")
    return normalized_value == flight_number


def _normalize_status(status: str) -> str:
    value = status.lower().strip()
    if "cancel" in value:
        return "cancelled"
    if "delay" in value or "divert" in value:
        return "delayed"
    if value in ["active", "scheduled", "landed", "on_time", "on time", "arrived", "departed"]:
        return "on_time"
    return "unknown"


def _extract_status(payload, flight_number: str) -> str:
    if isinstance(payload, dict):
        for key in ["flight_status", "status", "state", "operation_status"]:
            if key in payload and isinstance(payload[key], str):
                return _normalize_status(payload[key])

        flight = payload.get("flight")
        if isinstance(flight, dict):
            for key in ["iata", "icao", "number", "callsign"]:
                if key in flight and isinstance(flight[key], str) and _flight_matches(flight[key], flight_number):
                    for status_key in ["flight_status", "status", "state"]:
                        if status_key in payload and isinstance(payload[status_key], str):
                            return _normalize_status(payload[status_key])

        data = payload.get("data")
        if isinstance(data, list):
            return _extract_status(data, flight_number)

        states = payload.get("states")
        if isinstance(states, list):
            for state in states:
                if isinstance(state, list) and len(state) > 1 and isinstance(state[1], str):
                    if _flight_matches(state[1], flight_number):
                        return "on_time"

    if isinstance(payload, list):
        fallback = "unknown"
        for item in payload:
            if isinstance(item, dict):
                flight = item.get("flight")
                if isinstance(flight, dict):
                    for key in ["iata", "icao", "number", "callsign"]:
                        if key in flight and isinstance(flight[key], str) and _flight_matches(flight[key], flight_number):
                            return _extract_status(item, flight_number)

                for key in ["flight", "flight_number", "flightNumber", "iata", "icao", "callsign"]:
                    if key in item and isinstance(item[key], str) and _flight_matches(item[key], flight_number):
                        return _extract_status(item, flight_number)

                candidate = _extract_status(item, flight_number)
                if candidate in ["delayed", "cancelled", "on_time"]:
                    fallback = candidate

        return fallback

    return "unknown"


def _resolve_status_from_json(raw_body: str, flight_number: str) -> str:
    try:
        parsed = json.loads(raw_body)
    except Exception:
        return "api_error"

    return _extract_status(parsed, flight_number)


class RialoCover(gl.Contract):
    owner: Address
    nextPolicyId: u256
    payoutMultiplier: u256
    apiUrlTemplate: str
    policies: TreeMap[u256, Policy]

    def __init__(self, api_url_template: str = DEFAULT_FLIGHT_STATUS_URL):
        self.owner = gl.message.sender_address
        self.nextPolicyId = u256(1)
        self.payoutMultiplier = u256(5)
        self.apiUrlTemplate = api_url_template

    @gl.public.write.payable
    def fundPool(self) -> None:
        if gl.message.value == u256(0):
            raise Exception("Funding amount must be greater than zero")

    @gl.public.write
    def setApiUrlTemplate(self, api_url_template: str) -> None:
        if gl.message.sender_address != self.owner:
            raise Exception("Only owner can update API URL")
        if not api_url_template.startswith("https://"):
            raise Exception("API URL must use HTTPS")
        self.apiUrlTemplate = api_url_template

    @gl.public.write.payable
    def buyPolicy(self, flightNumber: str) -> u256:
        normalized_flight = _normalize_flight_number(flightNumber)
        premium = gl.message.value
        if premium < MIN_PREMIUM:
            raise Exception("Premium below minimum")

        payout = premium * self.payoutMultiplier
        if self.balance < payout:
            raise Exception("Insurance pool has insufficient payout liquidity")

        policy_id = self.nextPolicyId
        self.policies[policy_id] = Policy(
            id=policy_id,
            userAddress=gl.message.sender_address,
            flightNumber=normalized_flight,
            premiumPaid=premium,
            payoutAmount=payout,
            isResolved=False,
            resolutionStatus="active",
            lastCheckedAt=u256(0),
        )
        self.nextPolicyId = policy_id + u256(1)

        return policy_id

    @gl.public.write
    def checkFlightAndPayout(self, policyId: u256) -> str:
        policy = self.policies[policyId]
        if policy.userAddress != gl.message.sender_address:
            raise Exception("Only the policy owner can resolve this policy")
        if policy.isResolved:
            raise Exception("Policy already resolved")

        flight_number = policy.flightNumber
        api_url = self.apiUrlTemplate
        if "{flight}" in api_url:
            api_url = api_url.replace("{flight}", flight_number)

        def fetch_flight_status() -> str:
            try:
                response = gl.nondet.web.get(api_url)
                raw_body = response.text
            except Exception:
                return "api_error"

            return _resolve_status_from_json(raw_body, flight_number)

        status = gl.eq_principle.strict_eq(fetch_flight_status)
        policy.resolutionStatus = status
        policy.lastCheckedAt = policy.lastCheckedAt + u256(1)

        if status in ["delayed", "cancelled"]:
            if self.balance < policy.payoutAmount:
                policy.resolutionStatus = "pool_underfunded"
                self.policies[policyId] = policy
                return "pool_underfunded"

            policy.isResolved = True
            self.policies[policyId] = policy
            gl.emit_transfer(to=policy.userAddress, value=policy.payoutAmount, on="finalized")
            return status

        self.policies[policyId] = policy
        return status

    @gl.public.write
    def refundUnresolvedPolicy(self, policyId: u256) -> None:
        policy = self.policies[policyId]
        if policy.userAddress != gl.message.sender_address:
            raise Exception("Only the policy owner can refund this policy")
        if policy.isResolved:
            raise Exception("Policy already resolved")
        if policy.resolutionStatus not in ["api_error", "unknown", "pool_underfunded"]:
            raise Exception("Policy is still verifiable")

        policy.isResolved = True
        policy.resolutionStatus = "refunded"
        self.policies[policyId] = policy
        gl.emit_transfer(to=policy.userAddress, value=policy.premiumPaid, on="finalized")

    @gl.public.view
    def getPolicy(self, policyId: u256) -> Policy:
        return self.policies[policyId]

    @gl.public.view
    def getPolicyCount(self) -> u256:
        return self.nextPolicyId - u256(1)

    @gl.public.view
    def getPolicies(self, account: Address) -> DynArray[Policy]:
        result = gl.storage.inmem_allocate(DynArray[Policy])
        policy_id = u256(1)
        while policy_id < self.nextPolicyId:
            policy = self.policies[policy_id]
            if policy.userAddress == account:
                result.append(policy)
            policy_id = policy_id + u256(1)
        return result

    @gl.public.view
    def getContractBalance(self) -> u256:
        return self.balance
`; // Truncated for the UI display, will use full version in real deploy logic

export default function DeployPage() {
  const { isConnected, address } = useAccount();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  
  const { sendTransactionAsync } = useSendTransaction();

  async function handleDeploy() {
    if (!isConnected) {
      toast.error("Connect wallet first");
      return;
    }

    setIsDeploying(true);
    try {
      // In GenLayer, deployment is a transaction to 0x0 with the Python code in data
      // Note: This is the standard pattern for GenLayer-based chains like Rialo
      const tx = await sendTransactionAsync({
        to: "0x0000000000000000000000000000000000000000",
        data: stringToHex(CONTRACT_CODE),
      });
      
      toast.success("Deployment transaction sent!", {
        description: "Check your wallet for the contract address once confirmed.",
      });
      
      // Since we don't have the full GenLayer SDK to wait and parse the address easily,
      // we guide the user to check their explorer or wallet.
    } catch (error: any) {
      console.error(error);
      toast.error("Deployment failed", { description: error.message });
    } finally {
      setIsDeploying(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(CONTRACT_CODE);
    toast.success("Code copied to clipboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-12">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Rocket className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tight">Contract Deployer</h1>
          <p className="text-muted-foreground text-lg">Deploy your Intelligent Rialo Cover contract to Rialo Testnet</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        <div className="space-y-6">
          <Card className="border-white/10 bg-card/50 backdrop-blur overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 bg-white/[0.02] py-4">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-primary" />
                <span className="text-xs font-mono uppercase tracking-widest opacity-70">rialo_cover.py</span>
              </div>
              <Button variant="ghost" size="sm" onClick={copyCode} className="h-8 gap-2">
                <Copy className="h-3 w-3" />
                Copy
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="p-6 text-sm font-mono overflow-x-auto text-primary/90 max-h-[500px]">
                <code>{CONTRACT_CODE}</code>
              </pre>
            </CardContent>
          </Card>

          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 flex gap-4 items-start">
            <AlertCircle className="h-6 w-6 text-primary shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-bold text-primary">Deployment Instruction</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This tool will send a deployment transaction to the Rialo network. 
                Ensure your wallet is connected to the <strong>Rialo Testnet</strong>. 
                After deployment, you will need to copy the contract address from the transaction 
                receipt and update your <code>.env</code> file.
              </p>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <Card className="border-white/10 bg-card/80 shadow-glow backdrop-blur sticky top-8">
            <CardHeader>
              <CardTitle>Launch Dashboard</CardTitle>
              <CardDescription>Final check before network broadcast</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Network</span>
                  <span className="font-medium text-primary">Rialo Testnet</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Contract Type</span>
                  <span className="font-medium">Intelligent (Python)</span>
                </div>
                <div className="flex justify-between text-sm border-t border-white/5 pt-4">
                  <span className="text-muted-foreground">Status</span>
                  <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                    Ready to Deploy
                  </span>
                </div>
              </div>

              <Button 
                onClick={handleDeploy} 
                disabled={!isConnected || isDeploying} 
                className="w-full h-14 text-lg font-bold group"
              >
                {isDeploying ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Rocket className="mr-2 h-5 w-5 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
                )}
                {isDeploying ? "Deploying..." : "Deploy to Rialo"}
              </Button>

              {!isConnected && (
                <p className="text-xs text-center text-muted-foreground">Connect your wallet in the header to start</p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Alternative Method</h4>
            <a 
              href="https://studio.genlayer.com" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            >
              <span className="text-sm font-medium">Open in GenLayer Studio</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </a>
          </div>
        </aside>
      </div>
    </main>
  );
}
