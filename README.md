# Rialo Cover: Intelligent Parametric Insurance

Rialo Cover is a next-generation parametric insurance platform built on the Rialo/GenLayer ecosystem. It leverages **Intelligent Contracts** to automate the entire insurance lifecycle: from policy purchase to autonomous claim resolution, without the need for centralized oracles or manual intervention.

## Core Innovation: Intelligent Contracts

Unlike traditional smart contracts that rely on external oracles to push data onto the chain, Rialo Cover uses GenLayer's non-deterministic execution model. The contract itself performs HTTPS requests to verify real-world events (like flight status) and reaches consensus on the results through the validator network.

### Key Features
- **Deterministic Outcomes from Non-Deterministic Data**: High-integrity resolution using `gl.eq_principle.strict_eq`.
- **Zero-Backend Architecture**: All policy states and logic reside on-chain; the frontend interfaces directly with the intelligent contract.
- **Instant Payouts**: Claims are settled as soon as the flight status is verified as "delayed" or "cancelled".
- **Refund Recovery**: Integrated paths for API errors or pool underfunding.

## Multi-Cover Extensibility
While this repository demonstrates **Flight Delay Insurance**, the architecture is designed to be modular. By modifying the API logic in the intelligent contract, the same framework can be extended to:
- **Weather Insurance**: Parametric cover for agricultural or event-based weather risks.
- **Price Protection**: Hedging against real-world commodity or asset price shifts.
- **Logistics & Supply Chain**: Automatic payouts for shipping delays verified via logistics APIs.
- **Sports Results**: Parametric payouts based on verified game outcomes.

---

## Technical Stack
- **Smart Contract**: Python (GenLayer Intelligent Contract SDK)
- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Web3 Integration**: Wagmi, Viem, TanStack Query
- **UI Components**: Lucide Icons, Sonner (Toasts), Shadcn UI

---

## Getting Started

### 1. Smart Contract Setup
The core logic is located in `contracts/rialo_cover.py`. 
- To deploy, you can use the integrated **Contract Deployer** at `/deploy` within the application.
- Alternatively, deploy via [GenLayer Studio](https://studio.genlayer.com).

### 2. Frontend Configuration
Create a `.env.local` file (use `.env.example` as a template):
```bash
NEXT_PUBLIC_RIALO_COVER_CONTRACT=0xYourContractAddress
NEXT_PUBLIC_RIALO_RPC_URL=https://rpc.your-rialo-network.example
NEXT_PUBLIC_RIALO_CHAIN_ID=1337
```

### 3. Local Development
```bash
npm install
npm run dev
```

---

## Deployment
This project is optimized for deployment on **Vercel**. 
1. Connect your GitHub repository.
2. Configure the `NEXT_PUBLIC_*` environment variables in the Vercel dashboard.
3. Deploy.
