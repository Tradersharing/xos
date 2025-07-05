// ==== TradersharingSwap DApp Final ====
let provider, signer, currentTargetSelect = "";

const CHAIN_ID_HEX = "0x4F3";
const XOS_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: "XOS Testnet",
  nativeCurrency: { name: "XOS", symbol: "XOS", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.xoscan.io"],
  blockExplorerUrls: ["https://testnet.xoscan.io"]
};

const routerAddress = "0xdc7D6b58c89A554b3FDC4B5B10De9b4DbF39FB40";
const factoryAddress = "0x859d9f77544e0123D351Cb1203BbC68788c9Fb6E";

const routerAbi = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) external returns (uint[])",
  "function getAmountsOut(uint amountIn, address[] path) view returns (uint[])"
];
const factoryAbi = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];

const tokenList = [
  { address: "0x0AAB67cf6F2e99847b9A95DeC950B250D648c1BB", symbol: "wXOS" },
  { address: "0x2CCDB83a043A32898496c1030880Eb2cB977CAbc", symbol: "USDT" },
  { address: "0xb2C1C007421f0Eb5f4B3b3F38723C309Bb208d7d", symbol: "USDC" },
  { address: "0xb129536147c0CA420490d6b68d5bb69D7Bc2c151", symbol: "TSR" }
];

function getSymbol(address) {
  const t = tokenList.find(x => x.address === address);
  return t ? t.symbol : "TOKEN";
}

function getSlippage() {
  const el = document.getElementById("slippage");
  const p = parseFloat((el?.value || "1").replace(",", "."));
  return isNaN(p) ? 1 : p;
}

async function connectWallet() {
  try {
    if (!window.ethereum) return alert("Please install MetaMask / OKX Wallet");
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
    const xosBalance = await provider.getBalance(address);

    document.getElementById("walletStatus").innerText = `Connected: ${shortenAddress(address)} | ${parseFloat(ethers.formatEther(xosBalance)).toFixed(4)} XOS`;
    document.getElementById("btnConnect").innerText = "Connected";
    document.getElementById("btnSwap").disabled = false;
    populateTokenDropdowns();
  } catch (err) {
    console.error(err);
    alert("\u274C Failed to connect wallet");
  }
}

function shortenAddress(a) {
  return a.slice(0, 6) + "..." + a.slice(-4);
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
    const html = `<div class="token-item" onclick="selectToken('${t.address}','${t.symbol}')">
      <div class="token-info">
        <img src="assets/icons/${t.symbol.toLowerCase()}.png" onerror="this.src='assets/icons/blank.png'">
        <div class="token-symbol">${t.symbol}</div>
      </div>
      <div class="token-balance" id="balance-${t.symbol}">...</div>
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
  if (address === otherVal) return alert("\u26A0\uFE0F Token tidak boleh sama!");

  document.getElementById(currentTargetSelect + "Btn").innerHTML = `
    <img src="assets/icons/${symbol.toLowerCase()}.png" onerror="this.src='assets/icons/blank.png'">
    <span>${symbol}</span>`;

  const balanceEl = document.getElementById(currentTargetSelect + "Balance");
  balanceEl.innerHTML = "Balance: Loading...";
  getTokenBalance(address).then(b => {
    balanceEl.innerText = `Balance: ${b}`;
  });

  document.getElementById(currentTargetSelect).value = address;
  closeTokenSelector();
  const tIn = document.getElementById("tokenIn").value;
  const tOut = document.getElementById("tokenOut").value;
  document.getElementById("btnSwap").disabled = (tIn === tOut || !tIn || !tOut);
  updateRatePreview();
}

async function getTokenBalance(addr) {
  if (!signer || !provider) return "0.00";
  try {
    const user = await signer.getAddress();
    const abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
    const token = new ethers.Contract(addr, abi, provider);
    const [raw, dec] = await Promise.all([token.balanceOf(user), token.decimals()]);
    return parseFloat(ethers.formatUnits(raw, dec)).toFixed(4);
  } catch {
    return "0.00";
  }
}

async function doSwap() {
  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;
  let amountRaw = document.getElementById("amount").value;
  amountRaw = amountRaw.replace(",", ".");

  if (!ethers.isAddress(tokenIn) || !ethers.isAddress(tokenOut)) return alert("\u26A0\uFE0F Alamat token tidak valid.");
  if (!amountRaw || isNaN(amountRaw) || parseFloat(amountRaw) <= 0) return alert("\u26A0\uFE0F Jumlah token tidak valid.");
  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) return alert("\u26A0\uFE0F Token tidak boleh sama.");

  try {
    const recipient = await signer.getAddress();
    const slippage = getSlippage();
    const decimals = await new ethers.Contract(tokenIn, ["function decimals() view returns (uint8)"], provider).decimals();
    const amountIn = ethers.parseUnits(amountRaw, decimals);
    const amountOutMin = amountIn * BigInt(100 - slippage) / 100n;

    const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
    const router = new ethers.Contract(routerAddress, routerAbi, signer);
    const path = [tokenIn, tokenOut];

    const pair1 = await factory.getPair(tokenIn, tokenOut);
    const pair2 = await factory.getPair(tokenOut, tokenIn);
    if (pair1 === ethers.ZeroAddress && pair2 === ethers.ZeroAddress) {
      return alert("\u274C Tidak ada liquidity (LP) untuk pair ini, baik normal maupun terbalik.");
    }

    try {
      await router.getAmountsOut(amountIn, path);
    } catch (e) {
      console.warn("getAmountsOut error:", e);
      return alert("\u274C LP ditemukan tapi tidak bisa hitung amountOut. Mungkin reserve 0 atau route tidak valid.");
    }

    const token = new ethers.Contract(tokenIn, [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)"
    ], signer);
    const allowance = await token.allowance(recipient, routerAddress);
    if (allowance < amountIn) {
      const approveTx = await token.approve(routerAddress, amountIn);
      await approveTx.wait();
    }

    const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
    const tx = await router.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      recipient,
      deadline
    );
    const receipt = await tx.wait();
    document.getElementById("result").innerHTML = `\u2705 Swap Success! <a href="https://testnet.xoscan.io/tx/${receipt.hash}" target="_blank">View Tx</a>`;
  } catch (e) {
    console.error("\u274C Error saat swap:", e);
    alert("\u274C Gagal swap. Periksa jaringan, token, allowance, atau LP.");
  }
}

function updateRatePreview() {
  document.getElementById("ratePreview").innerText = "Rate unavailable";
  document.getElementById("amountOut").value = "";
}

window.addEventListener("load", () => {
  populateTokenDropdowns();
  document.getElementById("amount").addEventListener("input", updateRatePreview);
});

function populateTokenDropdowns() {
  // handled by popup selector
}
