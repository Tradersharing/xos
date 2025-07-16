// Deadline belum di tambahkan


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
const routerAddress = "0x8f99913ed8A24462F948630178dbd696BbB53e1B";
const factoryAddress = "0xc5a5febb72028eb2b2c7410473f77582f7deb90a";

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
  { address: "0x2CCDB83a043A32898496c1030880Eb2cB977CAbc", symbol: "USDT", decimals: 18 },
  { address: "0xb2C1C007421f0Eb5f4B3b3F38723C309Bb208d7d", symbol: "USDC", decimals: 18 },
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
    const symbolA = selectedLiquidityIn.symbol;
    const symbolB = selectedLiquidityOut.symbol;

    console.log("🛠 Router:", routerAddress);
    console.log("🛠 Factory:", factoryAddress);
    console.log("🔁 Token A:", tokenA, `(${symbolA})`);
    console.log("🔁 Token B:", tokenB, `(${symbolB})`);

    // [1] Desimal (sementara hardcoded)
    const decA = 18;
    const decB = 18;
    console.log(`🔢 Desimal A: ${decA} | Desimal B: ${decB}`);

    // [2] Konversi ke BigInt
    const amtA = ethers.parseUnits(amountADesired, decA);
    const amtB = ethers.parseUnits(amountBDesired, decB);
    console.log("💰 Amount A:", amtA.toString());
    console.log("💰 Amount B:", amtB.toString());

    // [3] Approve Token A
    showTxStatusModal("loading", `🔐 Approving ${symbolA}...`);
    const tokenAbi = ["function approve(address,uint256) returns (bool)"];
    const approveA = new ethers.Contract(tokenA, tokenAbi, signer);
    const txA = await approveA.approve(routerAddress, amtA);
    console.log(`⏳ Approve ${symbolA} TX sent:`, txA.hash);
    await txA.wait();
    console.log(`✅ Approve ${symbolA} confirmed`);
    await new Promise(r => setTimeout(r, 1000)); // delay 1 detik

    // [4] Approve Token B
    showTxStatusModal("loading", `🔐 Approving ${symbolB}...`);
    const approveB = new ethers.Contract(tokenB, tokenAbi, signer);
    const txB = await approveB.approve(routerAddress, amtB);
    console.log(`⏳ Approve ${symbolB} TX sent:`, txB.hash);
    await txB.wait();
    console.log(`✅ Approve ${symbolB} confirmed`);
    await new Promise(r => setTimeout(r, 1000)); // delay 1 detik

    // [5] Cek atau Buat Pair
    let pairAddress;
    try {
      pairAddress = await factoryContract.getPair(tokenA, tokenB);
      console.log("🔎 Pair Address (getPair):", pairAddress);
    } catch (e) {
      console.error("❌ getPair error:", e);
      throw new Error("❌ Gagal ambil pair dari factory");
    }
if (!pairAddress || pairAddress === ethers.ZeroAddress) {
  showTxStatusModal("loading", "🔨 Membuat Pair...");
  try {
    const createTx = await factoryContract.createPair(tokenA, tokenB);
    console.log("⏳ Tx createPair:", createTx.hash);
    await createTx.wait();
    console.log("✅ Pair berhasil dibuat");

    // 🔄 Update pairAddress setelah create
    pairAddress = await factoryContract.getPair(tokenA, tokenB);
    await new Promise(r => setTimeout(r, 3000));

    // ✅ Inisialisasi pair manual (jika belum otomatis)
    const pairAbi = [
      "function initialize(address,address) external",
      "function token0() view returns(address)",
      "function getReserves() view returns(uint112,uint112,uint32)"
    ];
    const pairContract = new ethers.Contract(pairAddress, pairAbi, signer);

    try {
      const t0 = await pairContract.token0();
      console.log("✅ Pair sudah di-initialize, token0:", t0);
    } catch {
      console.warn("⚠️ Pair belum initialize, mencoba initialize manual...");
      await pairContract.initialize(tokenA, tokenB);
      console.log("✅ Pair berhasil di-initialize manual");
    }

  } catch (e) {
    throw new Error("❌ Gagal membuat atau initialize pair baru: " + (e.reason || e.message));
  }
}

    

    // [6] Slippage dan Deadline
    const slippage = getSlippage(); // misal return 1~10
    const minA = amtA * BigInt(100 - slippage) / 100n;
    const minB = amtB * BigInt(100 - slippage) / 100n;
    const deadline = Math.floor(Date.now() / 1000) + 600;

    console.log("📉 Slippage:", slippage + "%");
    console.log("✅ minA:", minA.toString());
    console.log("✅ minB:", minB.toString());
    console.log("⏱ deadline (unix):", deadline);
    console.log("⏰ deadline (lokal):", new Date(deadline * 1000).toLocaleString());

    // [7] Kirim transaksi addLiquidity
    showTxStatusModal("loading", "🚀 Menambahkan Liquidity...");
    const tx = await routerContract.addLiquidity(
      tokenA,
      tokenB,
      amtA,
      amtB,
      minA,
      minB,
      userAddress,
      deadline
    );

    console.log("⏳ TX addLiquidity sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("🎉 Sukses TX:", receipt.transactionHash);

    // [8] Tampilkan hasil dan jeda 3 detik
    showTxStatusModal(
      "success",
      "✅ Liquidity Berhasil!",
      `${amountADesired} ${symbolA} + ${amountBDesired} ${symbolB}`,
      `https://testnet.xoscan.io/tx/${receipt.transactionHash}`
    );
    await new Promise(r => setTimeout(r, 3000)); // delay agar modal bisa dibaca

    hideTxStatusModal();
    updateAllBalances();

  } catch (err) {
    console.error("❌ ERROR DETAIL addLiquidity:", err);
    let msg = err?.reason || err?.message || "Unknown error";
    if (err?.error) msg += "\nRPC: " + JSON.stringify(err.error);
    if (err?.data) msg += "\nRevert: " + JSON.stringify(err.data);
    if (err?.transaction) msg += "\nTx: " + JSON.stringify(err.transaction);

    showTxStatusModal("error", "❌ Gagal Add Liquidity", msg, "");
    alert("🔍 Detail Error: " + msg);
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
