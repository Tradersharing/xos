// ==== TradersharingSwap DApp Final (Router: 0xdc7D6b58c89A554b3FDC4B5B10De9b4DbF39FB40) ====
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
const routerAbi = [
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) external returns (uint[])"
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

  // Validasi awal
  if (!ethers.isAddress(tokenIn)) return alert("⚠️ Alamat token input (tokenIn) tidak valid.");
  if (!ethers.isAddress(tokenOut)) return alert("⚠️ Alamat token output (tokenOut) tidak valid.");
  if (!amountRaw || isNaN(amountRaw) || parseFloat(amountRaw) <= 0) return alert("⚠️ Jumlah token tidak valid.");
  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) return alert("⚠️ Token tidak boleh sama!");

  try {
    const recipient = await signer.getAddress();
    const slippage = getSlippage();

    // Ambil desimal tokenIn
    const decimals = await new ethers.Contract(tokenIn, ["function decimals() view returns (uint8)"], provider).decimals();
    const amountIn = ethers.parseUnits(amountRaw, decimals);
    const minOut = amountIn * BigInt(100 - slippage) / 100n;
    const amountOutMin = minOut < 1n ? 0n : minOut;

    // Cek ketersediaan liquidity
    const routerRead = new ethers.Contract(routerAddress, [
      "function getAmountsOut(uint amountIn, address[] path) view returns (uint[])"
    ], provider);

    try {
      await routerRead.getAmountsOut(amountIn, [tokenIn, tokenOut]);
    } catch (e) {
      console.warn("No LP found:", e);
      return alert("🚫 Tidak ada liquidity untuk pair ini! Periksa apakah token pair-nya benar.");
    }

    // Cek & approve jika perlu
    const token = new ethers.Contract(tokenIn, [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)"
    ], signer);

    try {
      const allowance = await token.allowance(recipient, routerAddress);
      if (allowance < amountIn) {
        const approveTx = await token.approve(routerAddress, amountIn);
        await approveTx.wait();
      }
    } catch (e) {
      console.error("❌ Gagal approve:", e);
      return alert("❌ Gagal approve token. Periksa apakah contract token benar.");
    }

    // Swap token
    const router = new ethers.Contract(routerAddress, [
      "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to) external"
    ], signer);

    try {
      const tx = await router.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        [tokenIn, tokenOut],
        recipient
      );
      const receipt = await tx.wait();
      document.getElementById("result").innerHTML =
        `✅ Swap Success! <a href="https://testnet.xoscan.io/tx/${receipt.hash}" target="_blank">View Tx</a>`;
    } catch (e) {
      console.error("❌ Gagal swap:", e);
      return alert("❌ Gagal swap. Cek jaringan, liquidity, dan kontrak router!");
    }

  } catch (e) {
    console.error("❌ Error umum:", e);
    alert("❌ Terjadi error. Mungkin jaringan putus, kontrak salah, atau wallet tidak aktif.");
  }
}


async function updateRatePreview() {
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
