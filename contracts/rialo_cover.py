# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
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
