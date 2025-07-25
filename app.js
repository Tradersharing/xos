const decimalCache = {};
async function getDecimals(tokenAddress) {
  if (tokenAddress === "native") return 18;
  if (decimalCache[tokenAddress]) return decimalCache[tokenAddress];
  const contract = new ethers.Contract(tokenAddress, ["function decimals() view returns (uint8)"], provider);
  let dec = await contract.decimals();
  if (typeof dec !== "number") dec = dec.toNumber();  // Ini penting!
  decimalCache[tokenAddress] = dec;
  return dec;
}


// === Constants & Setup ===
let provider, signer, userAddress;
let activeSelectionType = null;

// Chain & Network Params
const CHAIN_ID_HEX = "0x4F3";
const XOS_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: "XOS Testnet",
  nativeCurrency: { name: "XOS", symbol: "XOS", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.xoscan.io"],
  blockExplorerUrls: ["https://testnet.xoscan.io"]
};


// Contract Addresses
const routerAddress = "0x55cA246FC7F514746d28867215d9F6f94AB9b257";
const factoryAddress = "0x62864f0fab6f10b8468ea5235ed2b28707b333e4";
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)"
];

// Minimal ABIs
const routerAbi = [
  "function addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256) returns (uint256,uint256,uint256)",
  "function removeLiquidity(address,address,uint256,uint256,uint256,address,uint256) returns (uint256,uint256)",
  "function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns (uint256[])",
  "function swapTokensForExactTokens(uint256,uint256,address[],address,uint256) returns (uint256[])",
  "function getAmountsOut(uint256,address[]) view returns (uint256[])",
  "function getAmountsIn(uint256,address[]) view returns (uint256[])",
  "function quote(uint256,uint256,uint256) view returns (uint256)",
  "function pairFor(address,address) view returns (address)",
  "function factory() view returns (address)"
];


const factoryAbi = [
  "function getPair(address,address) view returns(address)",
  "function createPair(address,address) returns(address)"
];

// Token List
const tokenList = [
  { address: "native", symbol: "XOS", decimals: 18 },
  { address: "0x0AAB67cf6F2e99847b9A95DeC950B250D648c1BB", symbol: "wXOS", decimals: 18 },
  { address: "0x2CCDB83a043A32898496c1030880Eb2cB977CAbc", symbol: "USDT", decimals: 6 },
  { address: "0xb2C1C007421f0Eb5f4B3b3F38723C309Bb208d7d", symbol: "USDC", decimals: 6 },
  { address: "0xb129536147c0CA420490d6b68d5bb69D7Bc2c151", symbol: "Tswap", decimals: 18 }
];


// Contracts & State
let routerContract, factoryContract;
let tokenSelector;
let selectedSwapIn = null, selectedSwapOut = null;
let selectedLiquidityIn = null, selectedLiquidityOut = null;

// === Initialization ===
document.addEventListener("DOMContentLoaded", async () => {
  if (!window.ethereum) {
    alert("Please install MetaMask or OKX Wallet.");
    return;
  }
  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  routerContract = new ethers.Contract(routerAddress, routerAbi, signer);
  factoryContract = new ethers.Contract(factoryAddress, factoryAbi, signer);
  tokenSelector = document.getElementById("tokenSelector");

  await ensureCorrectChain();
  await tryAutoConnect();
  document.getElementById("liquidityAmountA").addEventListener("input", updatePriceEstimate);
  document.getElementById("liquidityAmountB").addEventListener("input", updatePriceEstimate);
  document.getElementById("btnConnect").addEventListener("click", connectWallet);
  document.getElementById("tokenInBtn").addEventListener("click", () => openTokenSelector("swapIn"));
  document.getElementById("tokenOutBtn").addEventListener("click", () => openTokenSelector("swapOut"));
  document.getElementById("liquidityTokenInBtn").addEventListener("click", () => openTokenSelector("liqIn"));
  document.getElementById("liquidityTokenOutBtn").addEventListener("click", () => openTokenSelector("liqOut"));
  document.getElementById("amount").addEventListener("input", updateSwapPreview);
  document.getElementById("btnSwap").addEventListener("click", doSwap);
  document.getElementById("btnAddLiquidity").addEventListener("click", addLiquidity);

  document.querySelectorAll(".tab-bar button").forEach(btn => btn.addEventListener("click", () => switchPage(btn)));
  window.addEventListener("click", e => { if (e.target === tokenSelector) closeTokenSelector(); });

  populateTokenDropdowns();

  window.ethereum.on("accountsChanged", handleAccountsChanged);
  window.ethereum.on("chainChanged", () => window.location.reload());
});

// === Core Functions ===
async function connectWallet() {
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (accounts.length > 0) {
      userAddress = accounts[0];
      updateWalletUI();
      updateAllBalances();
    }
  } catch (e) {
    console.error(e);
    alert("❌ Wallet connection failed.");
  }
}

async function tryAutoConnect() {
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });

    if (accounts.length > 0) {
      userAddress = accounts[0];

      // 🔧 Pastikan provider dan signer dibuat ulang di sini
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();

      // 🔧 Re-inisialisasi kontrak setelah signer ada
      routerContract = new ethers.Contract(routerAddress, routerAbi, signer);
      factoryContract = new ethers.Contract(factoryAddress, factoryAbi, signer);

      updateWalletUI();
      updateAllBalances();
    } else {
      resetUI();
    }
  } catch (e) {
    console.error("❌ Error auto-connect:", e);
    resetUI();
  }
}


async function ensureCorrectChain() {
  try {
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== CHAIN_ID_HEX) await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
  } catch (e) {
    if (e.code === 4902) await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [XOS_PARAMS] });
  }
}

function updateWalletUI() {
  document.getElementById("walletStatus").innerText = `Connected: ${shortenAddress(userAddress)}`;
  document.getElementById("btnConnect").innerText = "Connected";
}

function resetUI() {
  userAddress = null;
  document.getElementById("walletStatus").innerText = "Not connected";
  document.getElementById("btnConnect").innerText = "Connect Wallet";
}

function handleAccountsChanged(accounts) {
  if (accounts.length === 0) resetUI(); else {
    userAddress = accounts[0];
    updateWalletUI();
    updateAllBalances();
  }
}

function shortenAddress(addr) {
  return addr.slice(0,6) + "..." + addr.slice(-4);
}

// === Token Selector ===
function openTokenSelector(type) {
  activeSelectionType = type;
  tokenSelector.classList.remove("hidden");
}

function closeTokenSelector() {
  tokenSelector.classList.add("hidden");
}

function populateTokenDropdowns() {
  const listEl = document.getElementById("tokenList");
  listEl.innerHTML = "";
  tokenList.forEach(tok => {
    const div = document.createElement("div");
    div.className = "token-item";
    div.dataset.address = tok.address;
    div.dataset.symbol = tok.symbol;
    div.innerHTML = `<div class='token-balance' id='bal-${tok.symbol}'>⏳</div><div class='token-symbol'>${tok.symbol}</div>`;
    div.onclick = () => selectToken(tok);
    listEl.appendChild(div);
    getBalance(tok).then(b => document.getElementById(`bal-${tok.symbol}`).innerText = `Balance: ${b}`);
  });
}

async function selectToken(tok) {
  if ((activeSelectionType === "swapIn" && selectedSwapOut?.symbol === tok.symbol) ||
      (activeSelectionType === "swapOut" && selectedSwapIn?.symbol === tok.symbol)) {
    return alert("Token sudah dipilih di sisi lain.");
  }
  if (activeSelectionType === "swapIn") selectedSwapIn = tok;
  if (activeSelectionType === "swapOut") selectedSwapOut = tok;
  if (activeSelectionType === "liqIn") selectedLiquidityIn = tok;
  if (activeSelectionType === "liqOut") selectedLiquidityOut = tok;
  updateSelectionUI(tok);
  closeTokenSelector();
}

function updateSelectionUI(tok) {
  const map = { swapIn: ["tokenInBtn","tokenInBalance"], swapOut: ["tokenOutBtn","tokenOutBalance"], liqIn: ["liquidityTokenInBtn","liquidityTokenInBalance"], liqOut: ["liquidityTokenOutBtn","liquidityTokenOutBalance"] };
  const [btnId, balId] = map[activeSelectionType];
  getBalance(tok).then(b => {
    document.getElementById(btnId).innerHTML = `<div class='token-balance-display'>Balance: ${b}</div><div class='token-symbol'>${tok.symbol}</div>`;
    document.getElementById(balId).innerText = `Balance: ${b}`;
  });
}

// === Balance & Swap ===
async function getBalance(tok) {
  if (!userAddress) return "0.00";
  if (tok.address === "native") {
    const b = await provider.getBalance(userAddress);
    return parseFloat(ethers.formatEther(b)).toFixed(4);
  }
  const c = new ethers.Contract(tok.address, ["function balanceOf(address) view returns(uint256)","function decimals() view returns(uint8)"], provider);
  const [raw, dec] = await Promise.all([c.balanceOf(userAddress), c.decimals()]);
  return parseFloat(ethers.formatUnits(raw, dec)).toFixed(4);
}

async function updateSwapPreview() {
  if (!selectedSwapIn || !selectedSwapOut) return;
  const val = document.getElementById("amount").value;
  if (!val || isNaN(val)) { document.getElementById("amountOut").value = ""; return; }
  const wei = ethers.parseUnits(val, selectedSwapIn.decimals);
  try {
    const amts = await routerContract.getAmountsOut(wei, [selectedSwapIn.address, selectedSwapOut.address]);
    document.getElementById("amountOut").value = ethers.formatUnits(amts[1], selectedSwapOut.decimals);
  } catch { document.getElementById("amountOut").value = ""; }
}
// =========== SLIPAGE=====
// Ambil slippage dari input
function getSlippage() {
  const s = parseFloat(document.getElementById("slippage").value);
  return isNaN(s) ? 1 : s;
}



//===SWAP=====
async function doSwap() {
  if (!userAddress) return alert("❌ Connect wallet dulu.");
  if (!selectedSwapIn || !selectedSwapOut) return alert("❗ Pilih token swap in/out");
  const val = document.getElementById("amount").value;
  if (!val || isNaN(val)) return alert("⚠️ Jumlah tidak valid");
  const wei = ethers.parseUnits(val, selectedSwapIn.decimals);
  if (selectedSwapIn.address !== "native") {
    await new ethers.Contract(selectedSwapIn.address, ["function approve(address,uint256) returns(bool)"], signer).approve(routerAddress, wei);
  }
  const tx = await routerContract.swapExactTokensForTokens(wei, 0, [selectedSwapIn.address, selectedSwapOut.address], userAddress, Math.floor(Date.now()/1000)+600);
  await tx.wait();
  alert("✅ Swap sukses");
  updateAllBalances();
}

// === Liquidity ===


async function addLiquidity() {
  if (!userAddress) return alert("❌ Connect wallet dulu.");
  if (!selectedLiquidityIn || !selectedLiquidityOut)
    return alert("❗ Pilih token A dan B untuk liquidity.");
  if (selectedLiquidityIn.address === selectedLiquidityOut.address)
    return alert("❗ Token A dan B harus berbeda.");

  const amountADesired = document.getElementById("liquidityAmountA").value;
  const amountBDesired = document.getElementById("liquidityAmountB").value;
  if (!amountADesired || !amountBDesired || isNaN(amountADesired) || isNaN(amountBDesired)) {
    return alert("⚠️ Jumlah tidak valid.");
  }

  setLiquidityLoading(true);
  showTxStatusModal("loading", "⏳ Menyiapkan transaksi...");

  try {
    const tokenA = selectedLiquidityIn.address;
    const tokenB = selectedLiquidityOut.address;

    console.log("🛠 Router:", routerAddress);
    console.log("🛠 Factory:", factoryAddress);
    console.log("🔁 Token A:", tokenA);
    console.log("🔁 Token B:", tokenB);

    // === [1] Ambil desimal token ===
    const decA = 18;
    const decB = 18;
    console.log("🔢 Desimal Token A:", decA);
    console.log("🔢 Desimal Token B:", decB);

    // === [2] Parse ke BigNumber ===
    const amtA = ethers.parseUnits(amountADesired, decA);
    const amtB = ethers.parseUnits(amountBDesired, decB);
    console.log("💰 Amount A:", amtA.toString());
    console.log("💰 Amount B:", amtB.toString());

    // === [3] Approve Token A ===
    showTxStatusModal("loading", "🔐 Approving Token A...");
    const tokenAbi = ["function approve(address,uint256) returns (bool)"];
    const approveA = new ethers.Contract(tokenA, tokenAbi, signer);
    const txA = await approveA.approve(routerAddress, amtA);
    console.log("⏳ Approve Token A Tx Sent:", txA.hash);
    await txA.wait();
    console.log("✅ Approve Token A Confirmed");

    // === [4] Approve Token B ===
    showTxStatusModal("loading", "🔐 Approving Token B...");
    const approveB = new ethers.Contract(tokenB, tokenAbi, signer);
    const txB = await approveB.approve(routerAddress, amtB);
    console.log("⏳ Approve Token B Tx Sent:", txB.hash);
    await txB.wait();
    console.log("✅ Approve Token B Confirmed");

    // === [5] Cek & Buat Pair ===
    console.log("🔍 Cek apakah pair sudah ada...");
    let existingPair = await factoryContract.getPair(tokenA, tokenB);
    console.log("🔍 Pair ditemukan:", existingPair);

    if (!existingPair || existingPair === ethers.ZeroAddress) {
      showTxStatusModal("loading", "🔨 Membuat pair baru...");
      const createTx = await factoryContract.createPair(tokenA, tokenB);
      console.log("⏳ Create Pair Tx Sent:", createTx.hash);
      await createTx.wait();
      console.log("✅ Pair berhasil dibuat");

      await new Promise(r => setTimeout(r, 4000));

      // Ambil ulang alamat pair
      existingPair = await factoryContract.getPair(tokenA, tokenB);
      console.log("📦 Pair Address setelah dibuat:", existingPair);
    }

    // ✅ Tambahan penting: setRouter jika belum diset
    try {
      const pairAbi = [
        "function setRouter(address)",
        "function router() view returns (address)"
      ];
      const pairContract = new ethers.Contract(existingPair, pairAbi, signer);
      const currentRouter = await pairContract.router();

      if (currentRouter.toLowerCase() !== routerAddress.toLowerCase()) {
        console.log("⚙️ Memanggil setRouter di Pair...");
        const setRouterTx = await pairContract.setRouter(routerAddress);
        console.log("⏳ setRouter tx sent:", setRouterTx.hash);
        await setRouterTx.wait();
        console.log("✅ setRouter berhasil");
      } else {
        console.log("✅ Router sudah diset sebelumnya:", currentRouter);
      }
    } catch (e) {
      console.warn("⚠️ Gagal setRouter, mungkin sudah diset:", e.message);
    }

    // === [6] Slippage & Deadline ===
    const slippage = getSlippage();
    const minA = amtA * BigInt(100 - slippage) / 100n;
    const minB = amtB * BigInt(100 - slippage) / 100n;
    const deadline = Math.floor(Date.now() / 1000) + 600;

    console.log("📉 Slippage:", slippage + "%");
    console.log("✅ minA:", minA.toString());
    console.log("✅ minB:", minB.toString());
    console.log("⏳ Deadline:", deadline);

    // === [7] Debug Parameter Lengkap ===
    console.log("=== PARAMETER ADD_LIQUIDITY ===");
    console.log("Router:", routerAddress);
    console.log("tokenA:", tokenA);
    console.log("tokenB:", tokenB);
    console.log("amtA:", amtA.toString());
    console.log("amtB:", amtB.toString());
    console.log("minA:", minA.toString());
    console.log("minB:", minB.toString());
    console.log("to:", userAddress);
    console.log("deadline:", deadline);

    // === [8] Eksekusi addLiquidity ===
    showTxStatusModal("loading", "🚀 Menambahkan Liquidity...");
    const tx = await routerContract.addLiquidity(
      tokenA, tokenB,
      amtA, amtB,
      minA, minB,
      userAddress,
      deadline
    );
    console.log("⏳ addLiquidity tx sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("🎉 Sukses addLiquidity TX:", receipt);

    showTxStatusModal(
      "success",
      "✅ Liquidity Berhasil!",
      `${amountADesired} ${selectedLiquidityIn.symbol} + ${amountBDesired} ${selectedLiquidityOut.symbol}`,
      `https://testnet.xoscan.io/tx/${receipt.hash}`
    );

    updateAllBalances();

  } catch (err) {
    console.error("❌ ERROR DETAIL addLiquidity:", err);

    let detailedMsg = err?.reason || err?.message || "Unknown error";
    if (err?.error && typeof err.error === "object") {
      detailedMsg += "\nRPC Error Data: " + JSON.stringify(err.error);
    }
    if (err?.data) {
      detailedMsg += "\nRevert Data: " + JSON.stringify(err.data);
    }
    if (err?.transaction) {
      detailedMsg += "\nTransaction Data: " + JSON.stringify(err.transaction);
    }

    showTxStatusModal(
      "error",
      "❌ Gagal Add Liquidity",
      detailedMsg,
      ""
    );
    alert("🔍 Detail Error: " + detailedMsg);
  } finally {
    setLiquidityLoading(false);
  }
}


// === Fungsi Loading ===
function setLiquidityLoading(state) {
  const el = document.getElementById("liquidityLoading");
  el.style.display = state ? "block" : "none";
  el.textContent = state ? "⏳ Memproses transaksi..." : "";
}

// === Fungsi Estimasi Harga ===
async function updatePriceEstimate() {
  const valA = document.getElementById("liquidityAmountA").value;
  const valB = document.getElementById("liquidityAmountB").value;
  const box = document.getElementById("priceEstimateBox");
  const loading = document.getElementById("priceEstimateLoading");
  const result = document.getElementById("priceEstimateResult");
  const info = document.getElementById("priceInfoText");

  // Reset tampilan
  result.style.display = "none";
  info.textContent = "";

  // Sembunyikan bila tidak ada input
  if (!valA || !valB || isNaN(valA) || isNaN(valB) || valA <= 0 || valB <= 0) {
    box.style.display = "none";
    return;
  }

  box.style.display = "block";
  loading.style.display = "block";

  try {
    // Estimasi harga = Token B / Token A
    const price = parseFloat(valB) / parseFloat(valA);
    await new Promise(r => setTimeout(r, 800)); // simulasi delay
    loading.style.display = "none";
    result.style.display = "block";
    info.textContent = `1 ${selectedLiquidityIn?.symbol || "Token A"} ≈ ${price.toFixed(6)} ${selectedLiquidityOut?.symbol || "Token B"}`;
  } catch (e) {
    info.textContent = "❌ Gagal menghitung estimasi.";
  }
}

// === Update Balances ===
async function updateAllBalances() {
  for (const tok of tokenList) {
    const bal = await getBalance(tok);
    const el = document.getElementById(`bal-${tok.symbol}`);
    if (el) el.innerText = `Balance: ${bal}`;
  }
}

function showTxStatusModal(status = "loading", message = "Submitting...", token = "", explorerUrl = "") {
  const modal = document.getElementById("txStatusModal");
  const icon = document.getElementById("txStatusIcon");
  const text = document.getElementById("txStatusText");
  const tokenEl = document.getElementById("txStatusToken");
  const link = document.getElementById("txExplorerLink");

  // Reset
  icon.className = "";
  link.style.display = "none";

  // Set status icon
  if (status === "loading") icon.classList.add("tx-spinner");
  else if (status === "success") icon.classList.add("tx-checkmark");
  else icon.classList.add("tx-error");

  // Update text
  text.textContent = message;
  tokenEl.textContent = token ? `Added ${token}` : "";
  
  // Block explorer link
  if (explorerUrl) {
    link.href = explorerUrl;
    link.style.display = "block";
  }

  modal.classList.remove("hidden");
}

function hideTxStatusModal() {
  document.getElementById("txStatusModal").classList.add("hidden");
}

// === Tab Switch ===
function switchPage(btn) {
  document.querySelectorAll(".tab-bar button").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  btn.classList.add("active");
  const tgt = btn.dataset.target;
  document.getElementById(tgt).classList.add("active");
}
