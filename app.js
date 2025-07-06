// === Konstanta & Setup ===
let provider, signer, currentTargetSelect = "";

const CHAIN_ID_HEX = "0x4F3";
const XOS_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: "XOS Testnet",
  nativeCurrency: { name: "XOS", symbol: "XOS", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.xoscan.io"],
  blockExplorerUrls: ["https://testnet.xoscan.io"]
};

const routerAddress = "0xb129536147c0CA420490d6b68d5bb69D7Bc2c151";
const factoryAddress = "0x122D9a2B9D5117377F6b123a727D08A99D4d24b8";
const routerAbi = [
  "function swapExactTokensForTokens(uint,uint,address[],address,uint) external returns (uint[])",
  "function swapExactETHForTokens(uint,address[],address,uint) payable external returns (uint[])",
  "function swapExactTokensForETH(uint,uint,address[],address,uint) external returns (uint[])",
  "function getAmountsOut(uint,address[]) view returns (uint[])"
];
const factoryAbi = [
  "function getPair(address,address) view returns(address)",
  "function createPair(address,address) returns(address)"
];
const lpAbi = ["function mint(address) returns(uint)"];

const tokenList = [
  { address: "native", symbol: "XOS" },
  { address: "0x0AAB67cf6F2e99847b9A95DeC950B250D648c1BB", symbol: "wXOS" },
  { address: "0x2CCDB83a043A32898496c1030880Eb2cB977CAbc", symbol: "USDT" },
  { address: "0xb2C1C007421f0Eb5f4B3b3F38723C309Bb208d7d", symbol: "USDC" },
  { address: "0xb129536147c0CA420490d6b68d5bb69D7Bc2c151", symbol: "TSR" }
];

// === Wallet Connect ===
async function connectWallet() {
  if (!window.ethereum) return alert("Please install MetaMask or OKX Wallet");
  try {
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId !== CHAIN_ID_HEX) {
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
      } catch (e) {
        if (e.code === 4902) await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [XOS_PARAMS] });
        else throw e;
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
function shortenAddress(a){ return a.slice(0,6)+"..."+a.slice(-4); }

// === Token Select Popup ===
function openTokenSelector(target) {
  currentTargetSelect = target;
  document.getElementById("tokenSelector").classList.remove("hidden");
  renderTokenList();
}
function closeTokenSelector() {
  document.getElementById("tokenSelector").classList.add("hidden");
}

function populateTokenDropdowns() {}
function getSymbol(addr) {
  const t = tokenList.find(t=>t.address.toLowerCase()===addr.toLowerCase());
  return t?t.symbol:(addr==="native"?"XOS":"TOKEN");
}

// === Token List ===
async function renderTokenList() {
  const el = document.getElementById("tokenList");
  el.innerHTML = "";
  for (const t of tokenList) {
    const html = `<div class='token-item' onclick="selectToken('${t.address}','${t.symbol}')">
      <div class='token-info'>
        <img src='assets/icons/${t.symbol.toLowerCase()}.png' onerror="this.src='assets/icons/blank.png'">
        <div class='token-symbol'>${t.symbol}</div>
      </div>
      <div class='token-balance' id='balance-${t.symbol}'>⏳</div>
    </div>`;
    el.insertAdjacentHTML("beforeend", html);
    getTokenBalance(t.address).then(b => {
      const target = document.getElementById(`balance-${t.symbol}`);
      if (target) target.innerText = b;
    });
  }
}

function selectToken(address, symbol) {
  const isSwap = document.getElementById("swap").classList.contains("active");
  const target = currentTargetSelect;
  const other = target === "tokenIn" ? "tokenOut" : "tokenIn";
  const currentInputId = (isSwap ? "swap" : "liquidity") + target.charAt(0).toUpperCase() + target.slice(1);
  const otherInputId = (isSwap ? "swap" : "liquidity") + other.charAt(0).toUpperCase() + other.slice(1);
  if (address === document.getElementById(otherInputId)?.value) return alert("⚠️ Token tidak boleh sama!");
  document.getElementById(target + "Btn").innerHTML = `
    <img src='assets/icons/${symbol.toLowerCase()}.png' onerror="this.src='assets/icons/blank.png'">
    <span>${symbol}</span>`;
  getTokenBalance(address).then(bal => {
    document.getElementById(target + "Balance").innerText = `Balance: ${bal}`;
  });
  document.getElementById(currentInputId).value = address;
  closeTokenSelector();
  if (isSwap) updateRatePreview();
}

// === Balance ===
async function getTokenBalance(addr) {
  if (!signer) return "0.00";
  const user = await signer.getAddress();
  if (addr === "native") {
    const b = await provider.getBalance(user);
    return parseFloat(ethers.formatEther(b)).toFixed(4);
  }
  const c = new ethers.Contract(addr, ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"], provider);
  const [raw, d] = await Promise.all([c.balanceOf(user), c.decimals()]);
  return parseFloat(ethers.formatUnits(raw, d)).toFixed(4);
}

// === Rate Preview ===
async function updateRatePreview() {
  const inAddr = document.getElementById("tokenIn").value;
  const outAddr = document.getElementById("tokenOut").value;
  const amountRaw = document.getElementById("amount").value;
  const preview = document.getElementById("ratePreview");
  if (!inAddr || !outAddr || inAddr === outAddr || !amountRaw || isNaN(parseFloat(amountRaw))) {
    preview.innerText = ""; return;
  }
  try {
    const decIn = inAddr === "native" ? 18 : await new ethers.Contract(inAddr, ["function decimals() view returns (uint8)"], provider).decimals();
    const amountIn = ethers.parseUnits(amountRaw.replace(",", "."), decIn);
    const router = new ethers.Contract(routerAddress, routerAbi, provider);
    const paths = [[inAddr, outAddr], ...tokenList.filter(t => t.address !== inAddr && t.address !== outAddr).map(t => [inAddr, t.address, outAddr])];
    for (const p of paths) {
      try {
        const amounts = await router.getAmountsOut(amountIn, p);
        const decOut = outAddr === "native" ? 18 : await new ethers.Contract(outAddr, ["function decimals() view returns (uint8)"], provider).decimals();
        const estOut = ethers.formatUnits(amounts[amounts.length - 1], decOut);
        preview.innerText = `≈ ${estOut} ${getSymbol(outAddr)}`;
        document.getElementById("amountOut").value = estOut;
        return;
      } catch {}
    }
    preview.innerText = "🚫 LP tidak ditemukan.";
  } catch {
    preview.innerText = "🚫 Estimasi gagal.";
  }
}

// === Swap ===
async function doSwap() {
  const tokenIn = document.getElementById("swapTokenIn").value;
  const tokenOut = document.getElementById("swapTokenOut").value;
  const amountRaw = document.getElementById("amount").value.replace(",", ".");
  if (!tokenIn || !tokenOut || tokenIn === tokenOut || !amountRaw || isNaN(parseFloat(amountRaw))) return alert("⚠️ Data tidak valid.");
  try {
    const router = new ethers.Contract(routerAddress, routerAbi, signer);
    const recipient = await signer.getAddress();
    const slippage = getSlippage();
    const decimals = tokenIn === "native" ? 18 : await new ethers.Contract(tokenIn, ["function decimals() view returns (uint8)"], provider).decimals();
    const amountIn = ethers.parseUnits(amountRaw, decimals);
    const amountOutMin = amountIn * BigInt(100 - slippage) / 100n;
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const paths = [[tokenIn, tokenOut], ...tokenList.filter(t => t.address !== tokenIn && t.address !== tokenOut).map(t => [tokenIn, t.address, tokenOut])];
    let path = null;
    for (const p of paths) {
      try { await router.getAmountsOut(amountIn, p); path = p; break; } catch {}
    }
    if (!path) return alert("🚫 LP tidak ditemukan.");
    if (tokenIn === "native") {
      const tx = await router.swapExactETHForTokens(amountOutMin, path, recipient, deadline, { value: amountIn });
      const r = await tx.wait(); alert(`✅ Swap sukses! Tx: ${r.hash}`);
    } else {
      const token = new ethers.Contract(tokenIn, ["function allowance(address,address) view returns (uint256)", "function approve(address,uint256) returns (bool)"], signer);
      const allowance = await token.allowance(recipient, routerAddress);
      if (allowance < amountIn) {
        const approveTx = await token.approve(routerAddress, amountIn);
        await approveTx.wait();
      }
      if (tokenOut === "native") {
        const tx = await router.swapExactTokensForETH(amountIn, amountOutMin, path, recipient, deadline);
        const r = await tx.wait(); alert(`✅ Swap sukses! Tx: ${r.hash}`);
      } else {
        const tx = await router.swapExactTokensForTokens(amountIn, amountOutMin, path, recipient, deadline);
        const r = await tx.wait(); alert(`✅ Swap sukses! Tx: ${r.hash}`);
      }
    }
  } catch (e) {
    console.error(e);
    alert("❌ Swap gagal. Periksa token, jaringan, atau saldo.");
  }
}

// === Add Liquidity ===
async function addLiquidity() {
  const a = document.getElementById("tokenIn").value;
  const b = document.getElementById("tokenOut").value;
  if (!a || !b || a === b) return alert("⚠️ Pilih dua token berbeda.");
  const x = prompt(`Jumlah token A (${getSymbol(a)}):`);
  const y = prompt(`Jumlah token B (${getSymbol(b)}):`);
  if (!x || !y || isNaN(x) || isNaN(y)) return alert("⚠️ Jumlah tidak valid.");
  const factory = new ethers.Contract(factoryAddress, factoryAbi, signer);
  let pair = await factory.getPair(a, b);
  if (pair === ethers.ZeroAddress) {
    await (await factory.createPair(a, b)).wait();
    pair = await factory.getPair(a, b);
  }
  const tokenAbi = ["function decimals() view returns (uint8)", "function approve(address,uint) returns (bool)", "function transfer(address,uint) returns (bool)"];
  const [decA, decB] = await Promise.all([
    new ethers.Contract(a, tokenAbi, provider).decimals(),
    new ethers.Contract(b, tokenAbi, provider).decimals()
  ]);
  const amtA = ethers.parseUnits(x, decA);
  const amtB = ethers.parseUnits(y, decB);
  const ca = new ethers.Contract(a, tokenAbi, signer);
  const cb = new ethers.Contract(b, tokenAbi, signer);
  await (await ca.approve(pair, amtA)).wait();
  await (await cb.approve(pair, amtB)).wait();
  await (await ca.transfer(pair, amtA)).wait();
  await (await cb.transfer(pair, amtB)).wait();
  const lp = new ethers.Contract(pair, lpAbi, signer);
  await (await lp.mint(await signer.getAddress())).wait();
  alert("✅ Liquidity berhasil ditambahkan ke pair: " + pair);
}

// === Slippage ===
function getSlippage() {
  const v = parseFloat((document.getElementById("slippage").value||"1").replace(",","."));
  return isNaN(v)?1:v;
}

// === Switch Page ===
function switchPage(id, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".tab-bar button").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
}

// === Init ===
window.addEventListener("load", () => {
  document.getElementById("amount").addEventListener("input", updateRatePreview);
  populateTokenDropdowns();
});
