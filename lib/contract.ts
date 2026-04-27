import { isAddress, type Address } from "viem";

const configuredAddress = process.env.NEXT_PUBLIC_RIALO_COVER_CONTRACT;

export const RIALO_COVER_ADDRESS: Address | undefined = configuredAddress && isAddress(configuredAddress) && configuredAddress !== "0x0000000000000000000000000000000000000000"
  ? configuredAddress
  : undefined;

export const isContractConfigured = Boolean(RIALO_COVER_ADDRESS);

export const RIALO_COVER_ABI = [
  {
    type: "function",
    name: "buyPolicy",
    stateMutability: "payable",
    inputs: [{ name: "flightNumber", type: "string" }],
    outputs: [{ name: "policyId", type: "uint256" }],
  },
  {
    type: "function",
    name: "checkFlightAndPayout",
    stateMutability: "nonpayable",
    inputs: [{ name: "policyId", type: "uint256" }],
    outputs: [{ name: "status", type: "string" }],
  },
  {
    type: "function",
    name: "refundUnresolvedPolicy",
    stateMutability: "nonpayable",
    inputs: [{ name: "policyId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getPolicies",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      {
        name: "policies",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "userAddress", type: "address" },
          { name: "flightNumber", type: "string" },
          { name: "premiumPaid", type: "uint256" },
          { name: "payoutAmount", type: "uint256" },
          { name: "isResolved", type: "bool" },
          { name: "resolutionStatus", type: "string" },
          { name: "lastCheckedAt", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getContractBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;
