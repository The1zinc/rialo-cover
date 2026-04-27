import { defineChain } from "viem";
import { createConfig, http, injected } from "wagmi";

const chainId = Number(process.env.NEXT_PUBLIC_RIALO_CHAIN_ID ?? "1337");
const rpcUrl = process.env.NEXT_PUBLIC_RIALO_RPC_URL ?? "http://127.0.0.1:8545";
const chainName = process.env.NEXT_PUBLIC_RIALO_CHAIN_NAME ?? "Rialo Local";
const nativeSymbol = process.env.NEXT_PUBLIC_RIALO_NATIVE_SYMBOL ?? "RIA";

export const rialoChain = defineChain({
  id: Number.isFinite(chainId) ? chainId : 1337,
  name: chainName,
  nativeCurrency: {
    decimals: 18,
    name: nativeSymbol,
    symbol: nativeSymbol,
  },
  rpcUrls: {
    default: {
      http: [rpcUrl],
    },
  },
});

export const wagmiConfig = createConfig({
  chains: [rialoChain],
  connectors: [injected()],
  ssr: true,
  transports: {
    [rialoChain.id]: http(rpcUrl),
  },
});
