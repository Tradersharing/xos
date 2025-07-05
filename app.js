// DEX Swap App.js - Final Version (99% client-side, no server)

let provider, signer, currentTargetSelect = "";

const CHAIN_ID_HEX = "0x4F3";
const XOS_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: "XOS Testnet",
  nativeCurrency: { name: "XOS", symbol: "XOS", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.xoscan.io"],
  blockExplorerUrls: ["https://testnet.xoscan.io"]
};

const routerAddress = "0x999999992dbb0b0e125452d22a9fa5ada7a92c05"; // FreeSwap Router V2

const routerAbi = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) external returns (uint[])",
  "function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) payable external returns (uint[])",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) external returns (uint[])",
  "function getAmountsOut(uint amountIn, address[] path) view returns (uint[])"
];

const tokenList = [
  { address: "native", symbol: "XOS" },
  { address: "0x0AAB67cf6F2e99847b9A95DeC950B250D648c1BB", symbol: "wXOS" },
  { address: "0x2CCDB83a043A32898496c1030880Eb2cB977CAbc", symbol: "USDT" },
  { address: "0xb2C1C007421f0Eb5f4B3b3F38723C309Bb208d7d", symbol: "USDC" },
  { address: "0xb129536147c0CA420490d6b68d5bb69D7Bc2c151", symbol: "TSR" }
];

function getSymbol(addr) {
  const t = tokenList.find(t => t.address.toLowerCase() === addr.toLowerCase());
  return t ? t.symbol : addr === "native" ? "XOS" : "TOKEN";
}

function getSlippage() {
  const el = document.getElementById("slippage");
  const p = parseFloat((el?.value || "1").replace(",", "."));
  return isNaN(p) ? 1 : p;
}

async function connectWallet() {
  try {
    if (!window.ethereum) return alert("Please install MetaMask or OKX Wallet");
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId !== CHAIN_ID_HEX) {
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
      } catch (e) {
        if (e.code === 4902) {
          await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [XOS_PARAMS] });
        } else throw e;
      }
    }

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    const address = await signer.getAddress();
    const bal = await provider.getBalance(address);
    document.getElementById("walletStatus").innerText = `Connected: ${shortenAddress(address)} | ${parseFloat(ethers.formatEther(bal)).toFixed(4)} XOS`;
    document.getElementById("btnConnect").innerText = "Connected";
    document.getElementById("btnSwap").disabled = false;
    populateTokenDropdowns();
  } catch (err) {
    console.error(err);
    alert("❌ Failed to connect wallet");
  }
}

function shortenAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function openTokenSelector(target) {
  currentTargetSelect = target;
  document.getElementById("tokenSelector").classList.remove("hidden");
  renderTokenList();
}

function closeTokenSelector() {
  document.getElementById("tokenSelector").classList.add("hidden");
}

async function renderTokenList() {
  const el = document.getElementById("tokenList");
  el.innerHTML = "";
  for (const t of tokenList) {
    const html = `<div class='token-item' onclick="selectToken('${t.address}','${t.symbol}')">
      <div class='token-info'>
        <img src='assets/icons/${t.symbol.toLowerCase()}.png' onerror="this.src='assets/icons/blank.png'">
        <div class='token-symbol'>${t.symbol}</div>
      </div>
      <div class='token-balance' id='balance-${t.symbol}'>...</div>
    </div>`;
    el.insertAdjacentHTML("beforeend", html);
    getTokenBalance(t.address).then(bal => {
      document.getElementById(`balance-${t.symbol}`).innerText = `${bal}`;
    });
  }
}

async function selectToken(address, symbol) {
  const other = currentTargetSelect === "tokenIn" ? "tokenOut" : "tokenIn";
  const otherVal = document.getElementById(other).value;
  if (address === otherVal) return alert("⚠️ Token tidak boleh sama!");

  document.getElementById(currentTargetSelect + "Btn").innerHTML = `
    <img src='assets/icons/${symbol.toLowerCase()}.png' onerror="this.src='assets/icons/blank.png'">
    <span>${symbol}</span>`;

  const balanceEl = document.getElementById(currentTargetSelect + "Balance");
  balanceEl.innerHTML = "Balance: Loading...";
  getTokenBalance(address).then(b => {
    balanceEl.innerText = `Balance: ${b}`;
  });

  document.getElementById(currentTargetSelect).value = address;
  closeTokenSelector();
  updateRatePreview();
}

async function getTokenBalance(addr) {
  if (!signer || !provider) return "0.00";
  try {
    const user = await signer.getAddress();
    if (addr === "native") {
      const bal = await provider.getBalance(user);
      return parseFloat(ethers.formatEther(bal)).toFixed(4);
    }
    const abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
    const token = new ethers.Contract(addr, abi, provider);
    const [raw, dec] = await Promise.all([token.balanceOf(user), token.decimals()]);
    return parseFloat(ethers.formatUnits(raw, dec)).toFixed(4);
  } catch {
    return "0.00";
  }
}

async function updateRatePreview() {
  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;
  const amountRaw = document.getElementById("amount").value;
  if (!tokenIn || !tokenOut || tokenIn === tokenOut || !amountRaw) return;

  try {
    const decimals = tokenIn === "native" ? 18 : await new ethers.Contract(tokenIn, ["function decimals() view returns (uint8)"], provider).decimals();
    const amountIn = ethers.parseUnits(amountRaw.replace(",", "."), decimals);
    const router = new ethers.Contract(routerAddress, routerAbi, provider);

    const tryPaths = [
      [tokenIn, tokenOut],
      ...tokenList.filter(t => t.address !== tokenIn && t.address !== tokenOut).map(t => [tokenIn, t.address, tokenOut])
    ];

    for (const path of tryPaths) {
      try {
        const out = await router.getAmountsOut(amountIn, path);
        const outDec = tokenOut === "native" ? 18 : await new ethers.Contract(tokenOut, ["function decimals() view returns (uint8)"], provider).decimals();
        const formatted = ethers.formatUnits(out[out.length - 1], outDec);
        document.getElementById("ratePreview").innerText = `≈ ${formatted} ${getSymbol(tokenOut)}`;
        document.getElementById("amountOut").value = formatted;
        return;
      } catch {}
    }

    document.getElementById("ratePreview").innerText = "🚫 LP tidak ditemukan.";
  } catch {
    document.getElementById("ratePreview").innerText = "🚫 Gagal estimasi.";
  }
}

async function doSwap() {
  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;
  let amountRaw = document.getElementById("amount").value.replace(",", ".");

  if (!tokenIn || !tokenOut || tokenIn === tokenOut || !amountRaw || isNaN(parseFloat(amountRaw))) {
    return alert("⚠️ Data tidak valid.");
  }

  try {
    const router = new ethers.Contract(routerAddress, routerAbi, signer);
    const recipient = await signer.getAddress();
    const slippage = getSlippage();
    const decimals = tokenIn === "native" ? 18 : await new ethers.Contract(tokenIn, ["function decimals() view returns (uint8)"], provider).decimals();
    const amountIn = ethers.parseUnits(amountRaw, decimals);
    const amountOutMin = amountIn * BigInt(100 - slippage) / 100n;
    const deadline = Math.floor(Date.now() / 1000) + 600;

    const tryPaths = [
      [tokenIn, tokenOut],
      ...tokenList.filter(t => t.address !== tokenIn && t.address !== tokenOut).map(t => [tokenIn, t.address, tokenOut])
    ];

    let path = null;
    for (const p of tryPaths) {
      try {
        await router.getAmountsOut(amountIn, p);
        path = p;
        break;
      } catch {}
    }
    if (!path) return alert("🚫 Tidak ada LP tersedia.");

    if (tokenIn === "native") {
      const tx = await router.swapExactETHForTokens(amountOutMin, path, recipient, deadline, { value: amountIn });
      const r = await tx.wait();
      return alert(`✅ Swap sukses! Tx: ${r.hash}`);
    } else {
      const token = new ethers.Contract(tokenIn, ["function allowance(address owner, address spender) view returns (uint256)", "function approve(address spender, uint256) returns (bool)"], signer);
      const allowance = await token.allowance(recipient, routerAddress);
      if (allowance < amountIn) {
        const approveTx = await token.approve(routerAddress, amountIn);
        await approveTx.wait();
      }

      if (tokenOut === "native") {
        const tx = await router.swapExactTokensForETH(amountIn, amountOutMin, path, recipient, deadline);
        const r = await tx.wait();
        return alert(`✅ Swap sukses! Tx: ${r.hash}`);
      } else {
        const tx = await router.swapExactTokensForTokens(amountIn, amountOutMin, path, recipient, deadline);
        const r = await tx.wait();
        return alert(`✅ Swap sukses! Tx: ${r.hash}`);
      }
    }
  } catch (e) {
    console.error(e);
    alert("❌ Swap gagal. Periksa jaringan, token, atau LP.");
  }
}

window.addEventListener("load", () => {
  populateTokenDropdowns();
  document.getElementById("amount").addEventListener("input", updateRatePreview);
});

function populateTokenDropdowns() {
  // handled by selector
}
