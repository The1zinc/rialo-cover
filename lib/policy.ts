import type { Address } from "viem";

export type PolicyCard = {
  id: bigint;
  userAddress: Address;
  flightNumber: string;
  premiumPaid: bigint;
  payoutAmount: bigint;
  isResolved: boolean;
  resolutionStatus: string;
  lastCheckedAt: bigint;
};

type RawPolicyTuple = readonly [bigint, Address, string, bigint, bigint, boolean, string, bigint];
type RawPolicyObject = {
  id: bigint;
  userAddress: Address;
  flightNumber: string;
  premiumPaid: bigint;
  payoutAmount: bigint;
  isResolved: boolean;
  resolutionStatus: string;
  lastCheckedAt: bigint;
};

export function normalizeFlightNumber(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9-]{2,12}$/.test(normalized)) return "";
  return normalized;
}

export function shortenAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function isRawPolicyObject(value: unknown): value is RawPolicyObject {
  return Boolean(value && typeof value === "object" && "id" in value && "flightNumber" in value);
}

function isRawPolicyTuple(value: unknown): value is RawPolicyTuple {
  return Array.isArray(value) && value.length >= 8;
}

export function toPolicyCards(value: unknown): PolicyCard[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): PolicyCard[] => {
    if (isRawPolicyObject(item)) {
      return [{ ...item, resolutionStatus: item.resolutionStatus || "active" }];
    }

    if (isRawPolicyTuple(item)) {
      return [
        {
          id: item[0],
          userAddress: item[1],
          flightNumber: item[2],
          premiumPaid: item[3],
          payoutAmount: item[4],
          isResolved: item[5],
          resolutionStatus: item[6] || "active",
          lastCheckedAt: item[7],
        },
      ];
    }

    return [];
  });
}
