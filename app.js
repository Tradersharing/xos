// ==== TradersharingSwap DApp (Router: 0x89ff1b118ec9315295801c594983ee190b9a4598) ====

let provider, signer, currentTargetSelect = "";

const CHAIN_ID_HEX = "0x4F3";
const XOS_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: "XOS Testnet",
  nativeCurrency: { name: "XOS", symbol: "XOS", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.xoscan.io"],
  blockExplorerUrls: ["https://testnet.xoscan.io"]
};

const routerAddress = "0x89ff1b118ec9315295801c594983ee190b9a4598";
const routerAbi = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address tokenIn, address tokenOut, address to) external",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external"
];

const tokenList = [
  { address: ethers.ZeroAddress, symbol: "XOS" },
  { address: "0x2CCDB83a043A32898496c1030880Eb2cB977CAbc", symbol: "USDT" },
  { address: "0x6D2Af57AaA70A10A145C5E5569F6E2F087D94E02", symbol: "USDC" },
  { address: "0xb129536147c0CA420490d6b68d5bb69D7Bc2c151", symbol: "Tswap" }
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
    alert("Failed to connect wallet");
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
  if (address === otherVal) return alert("⚠️ Token tidak boleh sama!");

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
    if (addr.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
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

async function doSwap() {
  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;
  let amountRaw = document.getElementById("amount").value;
  amountRaw = amountRaw.replace(",", ".");

  if (!ethers.isAddress(tokenIn) || !ethers.isAddress(tokenOut)) return alert("⚠️ Alamat token tidak valid.");
  if (!amountRaw || isNaN(amountRaw) || parseFloat(amountRaw) <= 0) return alert("⚠️ Jumlah token tidak valid.");
  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) return alert("⚠️ Token tidak boleh sama.");

  try {
    const recipient = await signer.getAddress();
    const slippage = getSlippage();
    const decimals = await new ethers.Contract(tokenIn, ["function decimals() view returns (uint8)"], provider).decimals();
    const amountIn = ethers.parseUnits(amountRaw, decimals);
    const minOut = amountIn * BigInt(100 - slippage) / 100n;
    const amountOutMin = minOut < 1n ? 0n : minOut;
    const path = [tokenIn, tokenOut];
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const router = new ethers.Contract(routerAddress, routerAbi, signer);

    if (tokenIn !== ethers.ZeroAddress) {
      const token = new ethers.Contract(tokenIn, ["function allowance(address,address) view returns (uint256)", "function approve(address,uint256) returns (bool)"], signer);
      const allowance = await token.allowance(recipient, routerAddress);
      if (allowance < amountIn) {
        const approveTx = await token.approve(routerAddress, amountIn);
        await approveTx.wait();
      }
    }

    try {
      await router.swapExactTokensForTokens.estimateGas(amountIn, amountOutMin, path, recipient, deadline);
    } catch (err) {
      console.error("⛔ estimateGas error:", err);
      document.getElementById("result").innerText = "❌ Swap gagal saat estimasi: " + (err.reason || err.message || "Unknown reason");
      return;
    }

    const tx = await router.swapExactTokensForTokens(amountIn, amountOutMin, path, recipient, deadline);
    const receipt = await tx.wait();
    document.getElementById("result").innerHTML = `✅ Swap Success! <a href="https://testnet.xoscan.io/tx/${receipt.hash}" target="_blank">View Tx</a>`;
  } catch (e) {
    console.error("❌ Error saat swap:", e);
    document.getElementById("result").innerText = "❌ Swap Failed: " + (e.reason || e.message || "Unknown error");
  }
}

function updateRatePreview() {
  document.getElementById("ratePreview").innerText = "Rate unavailable";
  document.getElementById("amountOut").value = "";
}

function populateTokenDropdowns() {
  // handled by popup selector
}

window.addEventListener("load", () => {
  populateTokenDropdowns();
  document.getElementById("amount").addEventListener("input", updateRatePreview);
});

/* === NEW: Error & success result messages === */
#result.error {
  color: #e53935;
}
#result.success {
  color: #10b981;
}

/* === NEW: Responsive hidden pages === */
.page {
  display: none;
}
.page.active {
  display: block;
}

/* === NEW: Footer Space === */
.footer-space {
  height: 58px;
}

/* === NEW: Network label di popup === */
.network-title {
  text-align: center;
  font-size: 13px;
  color: #555;
  margin-bottom: 10px;
}

/* === NEW: Loading animation for balance (fallback) */
.loading::after {
  content: " ⏳";
  display: inline-block;
  animation: spin 1s linear infinite;
}

