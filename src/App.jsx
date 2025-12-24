import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ArrowDown, Settings, Wallet, Info, RefreshCw, Plus, Twitter, Github, ChevronDown } from 'lucide-react';

const ROUTER_ADDRESS = "0xB0aA1d29339bdFaC68a791d4C13b0698A239D97C";
const WETH_ADDRESS = "0xc2F331332ca914685D773781744b1C589861C9Aa";

const ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)"
];

const ERC20_ABI = ["function approve(address spender, uint256 amount) external returns (bool)", "function allowance(address owner, address spender) view returns (uint256)", "function balanceOf(address owner) view returns (uint256)"];

export default function App() {
  const [tab, setTab] = useState('swap');
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [provider, setProvider] = useState(null);
  const [router, setRouter] = useState(null);

  // DAFTAR TOKEN LENGKAP
  const tokens = [
    { name: "X1T (Native)", symbol: "X1T", address: WETH_ADDRESS, isNative: true },
    { name: "TKA", symbol: "TKA", address: "0x6cF0576a5088ECE1cbc92cbDdD2496c8de5517FB", isNative: false },
    { name: "TKB", symbol: "TKB", address: "0x2C71ab7D51251BADaE2729E3F842c43fc6BB68c5", isNative: false }
  ];

  const [tokenA, setTokenA] = useState(tokens[0]);
  const [tokenB, setTokenB] = useState(tokens[1]);

  // Update Harga Otomatis Saat Token atau Input Berubah
  useEffect(() => {
    const fetchPrice = async () => {
      if (!amountA || !router || tab !== 'swap' || tokenA.address === tokenB.address) return;
      try {
        const path = [tokenA.address, tokenB.address];
        const amounts = await router.getAmountsOut(ethers.parseEther(amountA), path);
        setAmountB(ethers.formatEther(amounts[1]));
      } catch (e) { setAmountB("No Pool"); }
    };
    const timer = setTimeout(fetchPrice, 500);
    return () => clearTimeout(timer);
  }, [amountA, tokenA, tokenB, router, tab]);

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Install MetaMask");
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const prov = new ethers.BrowserProvider(window.ethereum);
    const sig = await prov.getSigner();
    setAccount(accounts[0]);
    setProvider(prov);
    setRouter(new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, sig));
  };

  const handleAction = async () => {
    if (!account) return connectWallet();
    setLoading(true);
    try {
      const sig = await provider.getSigner();
      const deadline = Math.floor(Date.now() / 1000) + 1200;
      const valA = ethers.parseEther(amountA || "0");
      const valB = ethers.parseEther(amountB === "No Pool" ? "0" : amountB || "0");

      if (!tokenA.isNative) {
        const tokenContract = new ethers.Contract(tokenA.address, ERC20_ABI, sig);
        const allowance = await tokenContract.allowance(account, ROUTER_ADDRESS);
        if (allowance < valA) {
          await (await tokenContract.approve(ROUTER_ADDRESS, ethers.MaxUint256)).wait();
        }
      }

      let tx;
      if (tab === 'swap') {
        const path = [tokenA.address, tokenB.address];
        tx = tokenA.isNative 
          ? await router.swapExactETHForTokens(0, path, account, deadline, { value: valA })
          : await router.swapExactTokensForETH(valA, 0, path, account, deadline);
      } else {
        const tokenAddr = tokenA.isNative ? tokenB.address : tokenA.address;
        const tAmt = tokenA.isNative ? valB : valA;
        const eAmt = tokenA.isNative ? valA : valB;
        tx = await router.addLiquidityETH(tokenAddr, tAmt, 0, 0, account, deadline, { value: eAmt });
      }
      await tx.wait();
      alert("Success!");
    } catch (e) { alert("Failed! Check Pool/Balance."); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#050c0a] text-emerald-500 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-emerald-900/10 blur-[130px] rounded-full shadow-[inset_0_0_100px_rgba(16,185,129,0.1)]"></div>
      
      <div className="z-10 w-full max-w-[460px] space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-emerald-500 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)] bg-emerald-500/5">
              <span className="font-black text-xl text-emerald-400 font-mono italic">D</span>
            </div>
            <h1 className="text-xl font-black tracking-[0.15em] uppercase italic text-emerald-400">Decentralized</h1>
          </div>
          <div className="flex items-center gap-3">
            {account ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-[10px] font-bold text-emerald-400 font-mono shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                {account.slice(0,6)}...
              </div>
            ) : (
              <button onClick={connectWallet} className="bg-emerald-500 text-black px-4 py-2 rounded-full text-[10px] font-black hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all">CONNECT</button>
            )}
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#0a1814]/90 backdrop-blur-2xl border border-emerald-500/20 rounded-[44px] p-6 shadow-2xl">
          <div className="flex bg-black/40 p-1.5 rounded-[22px] border border-emerald-900/30 mb-8">
            <button onClick={() => setTab('swap')} className={`flex-1 py-3 rounded-[18px] text-[11px] font-black uppercase tracking-[0.2em] transition-all ${tab === 'swap' ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'text-emerald-900'}`}>Swap</button>
            <button onClick={() => setTab('liquidity')} className={`flex-1 py-3 rounded-[18px] text-[11px] font-black uppercase tracking-[0.2em] transition-all ${tab === 'liquidity' ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'text-emerald-900'}`}>Liquidity</button>
          </div>

          <div className="space-y-2 relative">
            {/* Input A */}
            <div className="bg-black/40 border border-emerald-500/10 p-6 rounded-[32px] hover:border-emerald-500/30 transition-all">
              <label className="text-[10px] font-black text-emerald-900 uppercase tracking-widest block mb-4">You Pay</label>
              <div className="flex items-center gap-4">
                <input type="number" placeholder="0.0" value={amountA} onChange={(e) => setAmountA(e.target.value)} className="bg-transparent text-4xl font-bold text-emerald-500 w-full outline-none placeholder:text-emerald-950" />
                
                {/* SELECT TOKEN A */}
                <select 
                  value={tokenA.address} 
                  onChange={(e) => setTokenA(tokens.find(t => t.address === e.target.value))}
                  className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-2xl text-emerald-400 font-bold text-xs outline-none cursor-pointer appearance-none hover:bg-emerald-500/20 transition-all"
                >
                  {tokens.map(t => <option key={t.address} value={t.address} className="bg-[#0a1814]">{t.symbol}</option>)}
                </select>
              </div>
            </div>

            {/* Icon Switcher */}
            <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div onClick={() => {setTokenA(tokenB); setTokenB(tokenA)}} className="w-12 h-12 bg-[#050c0a] border-2 border-emerald-500 rounded-2xl flex items-center justify-center text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] rotate-45 hover:rotate-0 transition-all cursor-pointer group">
                <div className="-rotate-45 group-hover:rotate-0 transition-all">{tab === 'swap' ? <ArrowDown size={20} /> : <Plus size={20} />}</div>
              </div>
            </div>

            {/* Input B */}
            <div className="bg-black/40 border border-emerald-500/10 p-6 rounded-[32px] pt-12">
              <label className="text-[10px] font-black text-emerald-900 uppercase tracking-widest block mb-4">You Receive</label>
              <div className="flex items-center gap-4">
                <input type="text" readOnly placeholder="0.0" value={amountB} className="bg-transparent text-4xl font-bold text-emerald-100 w-full outline-none" />
                
                {/* SELECT TOKEN B */}
                <select 
                  value={tokenB.address} 
                  onChange={(e) => setTokenB(tokens.find(t => t.address === e.target.value))}
                  className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-2xl text-emerald-400 font-bold text-xs outline-none cursor-pointer appearance-none hover:bg-emerald-500/20 transition-all"
                >
                  {tokens.map(t => <option key={t.address} value={t.address} className="bg-[#0a1814]">{t.symbol}</option>)}
                </select>
              </div>
            </div>
          </div>

          <button 
            disabled={loading || !amountA || amountB === "No Pool"} 
            onClick={handleAction} 
            className="w-full mt-8 h-20 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-950 disabled:text-emerald-900 text-black rounded-[28px] font-black text-xl tracking-[0.3em] shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all flex items-center justify-center gap-3 uppercase"
          >
            {loading ? <RefreshCw className="animate-spin" /> : amountB === "No Pool" ? "No Liquidity" : tab === 'swap' ? 'Swap Tokens' : 'Add Supply'}
          </button>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-4 pt-4">
          <div className="flex gap-6">
            <a href="https://twitter.com/maxi_dak" target="_blank" rel="noreferrer" className="text-emerald-900 hover:text-emerald-400 transition-colors flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.2em]"><Twitter size={16} /> @maxi_dak</a>
            <a href="https://github.com/YFiN99" target="_blank" rel="noreferrer" className="text-emerald-900 hover:text-emerald-400 transition-colors flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.2em]"><Github size={16} /> YFiN99</a>
          </div>
        </div>
      </div>
    </div>
  );
}