import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function App() {
  const [account, setAccount] = useState('');
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState('swap');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [routerContract, setRouterContract] = useState(null);

  // CONFIG
  const ROUTER_ADDRESS = "0xB0aA1d29339bdFaC68a791d4C13b0698A239D97C";
  const WETH_ADDRESS = "0xc2F331332ca914685D773781744b1C589861C9Aa"; // Wrapped X1T

  const CHAIN_ID_HEX = "10778";

  const CHAIN_CONFIG = {
    chainId: CHAIN_ID_HEX,
    chainName: "Maculatus Testnet",
    nativeCurrency: { name: "X1 Token", symbol: "X1T", decimals: 18 },
    rpcUrls: ["https://maculatus-rpc.x1eco.com/"],
    blockExplorerUrls: ["https://maculatus-scan.x1eco.com/"]
  };

  // Token default termasuk X1T
  const DEFAULT_TOKENS = [
    { name: "X1T (Native)", address: WETH_ADDRESS, decimals: 18 },
    { name: "TKA", address: "0x6cF0576a5088ECE1cbc92cbDdD2496c8de5517FB", decimals: 18 },
    { name: "TKB", address: "0x2C71ab7D51251BADaE2729E3F842c43fc6BB68c5", decimals: 18 },
    { name: "TKC", address: "0x1234567890abcdef1234567890abcdef12345678", decimals: 18 },
  ];

  const [customTokens, setCustomTokens] = useState([]);
  useEffect(() => {
    const saved = localStorage.getItem('maculatusCustomTokens');
    if (saved) setCustomTokens(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('maculatusCustomTokens', JSON.stringify(customTokens));
  }, [customTokens]);

  const allTokens = [...DEFAULT_TOKENS, ...customTokens];

  const [newTokenAddress, setNewTokenAddress] = useState('');

  const ROUTER_ABI = [
    "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)",
    "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)"
  ];

  const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
  ];

  const connectWallet = async () => {
    if (!window.ethereum) {
      setStatus("Install MetaMask dulu!");
      return;
    }

    try {
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
      } catch (e) {
        if (e.code === 4902) {
          await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [CHAIN_CONFIG] });
        }
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0]);

      const prov = new ethers.BrowserProvider(window.ethereum);
      setProvider(prov);
      const sig = await prov.getSigner();
      setSigner(sig);
      setRouterContract(new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, sig));

      setStatus("Wallet connected!");
    } catch (err) {
      setStatus("Gagal: " + (err.message || ''));
    }
  };

  const addCustomToken = async () => {
    if (!ethers.isAddress(newTokenAddress)) {
      setStatus("Alamat invalid!");
      return;
    }

    if (allTokens.some(t => t.address.toLowerCase() === newTokenAddress.toLowerCase())) {
      setStatus("Token sudah ada!");
      return;
    }

    try {
      const tokenContract = new ethers.Contract(newTokenAddress, ERC20_ABI, provider || signer);
      const [symbol, decimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);

      const newToken = { name: symbol || "Unknown", address: newTokenAddress, decimals: Number(decimals) };
      setCustomTokens([...customTokens, newToken]);
      setNewTokenAddress('');
      setStatus(`Token ${symbol} ditambahkan!`);
    } catch (err) {
      setStatus("Gagal baca token");
    }
  };

  // SWAP
  const [tokenIn, setTokenIn] = useState(allTokens[0] || { decimals: 18 });
  const [tokenOut, setTokenOut] = useState(allTokens[1] || { decimals: 18 });
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [loadingQuote, setLoadingQuote] = useState(false);

  useEffect(() => {
    if (amountIn && routerContract && tokenIn.address && tokenOut.address) {
      getQuote();
    } else {
      setAmountOut('');
    }
  }, [amountIn, tokenIn, tokenOut, routerContract]);

  const getQuote = async () => {
    if (!amountIn || Number(amountIn) === 0) return;

    setLoadingQuote(true);
    try {
      const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
      const path = tokenIn.address === WETH_ADDRESS ? [WETH_ADDRESS, tokenOut.address] : tokenOut.address === WETH_ADDRESS ? [tokenIn.address, WETH_ADDRESS] : [tokenIn.address, tokenOut.address];
      const amounts = await routerContract.getAmountsOut(amountInWei, path);
      setAmountOut(ethers.formatUnits(amounts[1], tokenOut.decimals));
    } catch (err) {
      setAmountOut('No liquidity');
    }
    setLoadingQuote(false);
  };

  const executeSwap = async () => {
    if (!amountOut || amountOut === 'No liquidity') return;

    setStatus("Swapping...");
    try {
      const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
      const amountOutMin = ethers.parseUnits((Number(amountOut) * 0.95).toString(), tokenOut.decimals);
      const deadline = Math.floor(Date.now() / 1000) + 1200;

      let tx;

      if (tokenIn.address === WETH_ADDRESS) {
        // X1T → Token
        tx = await routerContract.swapExactETHForTokens(
          amountOutMin,
          [WETH_ADDRESS, tokenOut.address],
          account,
          deadline,
          { value: amountInWei }
        );
      } else if (tokenOut.address === WETH_ADDRESS) {
        // Token → X1T
        tx = await routerContract.swapExactTokensForETH(
          amountInWei,
          amountOutMin,
          [tokenIn.address, WETH_ADDRESS],
          account,
          deadline
        );
      } else {
        // Token → Token
        tx = await routerContract.swapExactTokensForTokens(
          amountInWei,
          amountOutMin,
          [tokenIn.address, tokenOut.address],
          account,
          deadline
        );
      }

      await tx.wait();
      setStatus("Swap berhasil!");
    } catch (err) {
      setStatus("Swap gagal: " + (err.reason || err.message || ''));
    }
  };

  // ADD LIQUIDITY
  const [liqTokenA, setLiqTokenA] = useState(allTokens[0] || { decimals: 18 });
  const [liqTokenB, setLiqTokenB] = useState(allTokens[1] || { decimals: 18 });
  const [liqAmountA, setLiqAmountA] = useState('');
  const [liqAmountB, setLiqAmountB] = useState('');

  const approveToken = async (token, amountStr) => {
    if (!amountStr || Number(amountStr) === 0) return;

    const tokenContract = new ethers.Contract(token.address, ERC20_ABI, signer);
    const amountWei = ethers.parseUnits(amountStr, token.decimals);
    const allowance = await tokenContract.allowance(account, ROUTER_ADDRESS);

    if (allowance >= amountWei) return;

    const tx = await tokenContract.approve(ROUTER_ADDRESS, ethers.MaxUint256);
    await tx.wait();
  };

  const addLiquidity = async () => {
    if (!liqAmountA || !liqAmountB) return;

    setStatus("Adding liquidity...");
    try {
      // Approve token (skip kalau X1T)
      if (liqTokenA.address !== WETH_ADDRESS) await approveToken(liqTokenA, liqAmountA);
      if (liqTokenB.address !== WETH_ADDRESS) await approveToken(liqTokenB, liqAmountB);

      const amountAWei = ethers.parseUnits(liqAmountA, liqTokenA.decimals);
      const amountBWei = ethers.parseUnits(liqAmountB, liqTokenB.decimals);
      const deadline = Math.floor(Date.now() / 1000) + 1200;

      let tx;

      if (liqTokenA.address === WETH_ADDRESS) {
        tx = await routerContract.addLiquidityETH(
          liqTokenB.address,
          amountBWei,
          0,
          0,
          account,
          deadline,
          { value: amountAWei }
        );
      } else if (liqTokenB.address === WETH_ADDRESS) {
        tx = await routerContract.addLiquidityETH(
          liqTokenA.address,
          amountAWei,
          0,
          0,
          account,
          deadline,
          { value: amountBWei }
        );
      } else {
        tx = await routerContract.addLiquidity(
          liqTokenA.address,
          liqTokenB.address,
          amountAWei,
          amountBWei,
          0,
          0,
          account,
          deadline
        );
      }

      await tx.wait();
      setStatus("Liquidity berhasil ditambahkan!");
    } catch (err) {
      setStatus("Gagal: " + (err.reason || err.message || ''));
    }
  };

  return (
    <div style={{ fontFamily: 'Arial', textAlign: 'center', padding: '20px', background: '#f0f2f5', minHeight: '100vh' }}>
      <h1>Maculatus Swap</h1>
      <p>Custom DEX di Maculatus Testnet</p>

      {!account ? (
        <button onClick={connectWallet} style={{ padding: '15px 30px', fontSize: '18px', background: '#0066ff', color: 'white', border: 'none', borderRadius: '8px' }}>
          Connect Wallet
        </button>
      ) : (
        <div>
          <p style={{ color: 'green' }}>Connected: {account.slice(0,6)}...{account.slice(-4)}</p>

          {/* Import Token Manual */}
          <div style={{ maxWidth: '500px', margin: '20px auto' }}>
            <input
              type="text"
              placeholder="Paste token address baru"
              value={newTokenAddress}
              onChange={e => setNewTokenAddress(e.target.value)}
              style={{ width: '70%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
            />
            <button onClick={addCustomToken} style={{ width: '28%', padding: '10px', marginLeft: '2%', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px' }}>
              Add Token
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', margin: '20px 0' }}>
            <button onClick={() => setActiveTab('swap')} style={{ padding: '10px 20px', background: activeTab === 'swap' ? '#0066ff' : '#ddd', color: 'white' }}>
              Swap
            </button>
            <button onClick={() => setActiveTab('liquidity')} style={{ padding: '10px 20px', background: activeTab === 'liquidity' ? '#0066ff' : '#ddd', color: 'white' }}>
              Add Liquidity
            </button>
          </div>

          {activeTab === 'swap' && (
            <div style={{ maxWidth: '400px', margin: '0 auto', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
              <h3>Swap Token</h3>

              <select value={tokenIn.address || ''} onChange={e => setTokenIn(allTokens.find(t => t.address === e.target.value) || allTokens[0])}>
                {allTokens.map(t => <option key={t.address} value={t.address}>{t.name}</option>)}
              </select>
              <input type="number" placeholder="Amount In" value={amountIn} onChange={e => setAmountIn(e.target.value)} style={{ width: '100%', padding: '10px', margin: '10px 0' }} />

              <div style={{ fontSize: '30px' }}>↓</div>

              <select value={tokenOut.address || ''} onChange={e => setTokenOut(allTokens.find(t => t.address === e.target.value) || allTokens[1])}>
                {allTokens.filter(t => t.address !== tokenIn.address).map(t => <option key={t.address} value={t.address}>{t.name}</option>)}
              </select>
              <input type="text" value={loadingQuote ? 'Loading...' : amountOut} readOnly style={{ width: '100%', padding: '10px', margin: '10px 0' }} />

              <button onClick={executeSwap} disabled={!amountOut || amountOut === 'No liquidity'} style={{ width: '100%', padding: '15px', background: '#0066ff', color: 'white', border: 'none', fontSize: '18px' }}>
                Swap
              </button>
            </div>
          )}

          {activeTab === 'liquidity' && (
            <div style={{ maxWidth: '400px', margin: '0 auto', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
              <h3>Add Liquidity</h3>

              <select value={liqTokenA.address || ''} onChange={e => setLiqTokenA(allTokens.find(t => t.address === e.target.value) || allTokens[0])}>
                {allTokens.map(t => <option key={t.address} value={t.address}>{t.name}</option>)}
              </select>
              <input type="number" placeholder="Amount A" value={liqAmountA} onChange={e => setLiqAmountA(e.target.value)} style={{ width: '100%', padding: '10px', margin: '10px 0' }} />

              <div style={{ fontSize: '30px' }}>+</div>

              <select value={liqTokenB.address || ''} onChange={e => setLiqTokenB(allTokens.find(t => t.address === e.target.value) || allTokens[1])}>
                {allTokens.filter(t => t.address !== liqTokenA.address).map(t => <option key={t.address} value={t.address}>{t.name}</option>)}
              </select>
              <input type="number" placeholder="Amount B" value={liqAmountB} onChange={e => setLiqAmountB(e.target.value)} style={{ width: '100%', padding: '10px', margin: '10px 0' }} />

              <button onClick={addLiquidity} style={{ width: '100%', padding: '15px', background: '#28a745', color: 'white', border: 'none', fontSize: '18px' }}>
                Add Liquidity
              </button>
            </div>
          )}
        </div>
      )}

      {status && <p style={{ marginTop: '20px', color: status.includes('berhasil') ? 'green' : 'red' }}>{status}</p>}
    </div>
  );
}

export default App;