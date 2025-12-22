import { useState } from "react";
import {
  RainbowKitProvider,
  ConnectButton,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import {
  WagmiProvider,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { http, parseUnits } from "viem";
import "@rainbow-me/rainbowkit/styles.css";

/* ================== CHAIN ================== */
const maculatusTestnet = {
  id: 10778,
  name: "Maculatus Testnet",
  nativeCurrency: { name: "X1T", symbol: "X1T", decimals: 18 },
  rpcUrls: { default: { http: ["https://maculatus-rpc.x1eco.com/"] } },
  blockExplorers: {
    default: {
      name: "Explorer",
      url: "https://maculatus-scan.x1eco.com/",
    },
  },
};

const config = getDefaultConfig({
  appName: "Maculatus Swap",
  projectId: "ANYTHING",
  chains: [maculatusTestnet],
  transports: {
    [maculatusTestnet.id]: http(),
  },
});

const queryClient = new QueryClient();

/* ================== CONTRACT ================== */
const TOKEN_A = "0x6cF0576a5088ECE1cbc92cbDdD2496c8de5517FB";
const TOKEN_B = "0x2C71ab7D51251BADaE2729E3F842c43fc6BB68c5";
const SWAP_ADDRESS = "0x67d4f19484Bd06603c20ff30a0ddB8EE2A3e9bd7";

const TOKEN_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

const SWAP_ABI = [
  {
    name: "swap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_tokenIn", type: "address" },
      { name: "_amountIn", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
];

/* ================== UI ================== */
function SwapInterface() {
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState(true); // true = A → B

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const handleAction = () => {
    if (!amount || Number(amount) <= 0)
      return alert("Masukkan amount valid");

    const amountWei = parseUnits(amount, 18);
    const tokenIn = direction ? TOKEN_A : TOKEN_B;

    if (isSuccess) {
      writeContract({
        address: SWAP_ADDRESS,
        abi: SWAP_ABI,
        functionName: "swap",
        args: [tokenIn, amountWei],
      });
    } else {
      writeContract({
        address: tokenIn,
        abi: TOKEN_ABI,
        functionName: "approve",
        args: [SWAP_ADDRESS, amountWei],
      });
    }
  };

  return (
    <div className="bg-white w-[420px] rounded-3xl shadow-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Swap</h1>
        <ConnectButton />
      </div>

      {/* FROM */}
      <div className="bg-gray-100 rounded-2xl p-4 mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>You pay</span>
          <span>{direction ? "TKA" : "TKB"}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-transparent outline-none text-2xl font-medium w-full"
          />
          <button className="bg-white px-3 py-1 rounded-xl shadow text-sm font-semibold">
            {direction ? "TKA" : "TKB"} ⌄
          </button>
        </div>
      </div>

      {/* ARROW */}
      <div className="flex justify-center my-2">
        <button
          onClick={() => setDirection(!direction)}
          className="bg-gray-200 w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-300"
        >
          ↓
        </button>
      </div>

      {/* TO */}
      <div className="bg-gray-100 rounded-2xl p-4 mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>You receive</span>
          <span>{direction ? "TKB" : "TKA"}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            placeholder="0.0"
            disabled
            className="bg-transparent outline-none text-2xl font-medium w-full text-gray-400"
          />
          <button className="bg-white px-3 py-1 rounded-xl shadow text-sm font-semibold">
            {direction ? "TKB" : "TKA"} ⌄
          </button>
        </div>
      </div>

      {/* ACTION */}
      <button
        onClick={handleAction}
        disabled={isPending || isConfirming}
        className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white py-3 rounded-2xl font-semibold transition"
      >
        {isPending
          ? "Approving..."
          : isConfirming
          ? "Swapping..."
          : isSuccess
          ? "Confirm Swap"
          : "Approve & Swap"}
      </button>

      {isSuccess && (
        <p className="text-green-600 text-sm mt-3 text-center">
          ✅ Approve berhasil. Klik lagi untuk swap.
        </p>
      )}

      <p className="text-xs text-gray-400 mt-4 text-center break-all">
        {SWAP_ADDRESS}
      </p>
    </div>
  );
}

/* ================== ROOT ================== */
export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <SwapInterface />
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
