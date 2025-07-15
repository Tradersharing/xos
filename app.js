// === Setup & Imports ===
const routerAddress = "0x08b154359d5e6d4c7f4c8a1f3e4a2a345fc25a4e"; // ubah sesuai alamat deploy kamu
const factoryAddress = "0xc5a5febb72028eb2b2c7410473f77582f7deb90a"; // ubah sesuai alamat deploy kamu

// ABI minimal untuk router dan factory sesuai kontrak kamu
const routerAbi = [
  "function addLiquidity(address,address,uint256,uint256,uint256,uint256,address) returns (uint256,uint256,uint256)",
  "function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) external returns (uint256[])",
  "function getAmountsOut(uint256,address[]) view returns(uint256[])"
];
const factoryAbi = [
  "function getPair(address,address) view returns(address)",
  "function createPair(address,address) returns(address)"
];

const tokenList = [
  { address: "native", symbol: "XOS", decimals: 18 },
  { address: "0x0AAB67cf6F2e99847b9A95DeC950B250D648c1BB", symbol: "wXOS", decimals: 18 },
  { address: "0x2CCDB83a043A32898496c1030880Eb2cB977CAbc", symbol: "USDT", decimals: 18 },
  { address: "0xb2C1C007421f0Eb5f4B3b3F38723C309Bb208d7d", symbol: "USDC", decimals: 18 },
  { address: "0xb129536147c0CA420490d6b68d5bb69D7Bc2c151", symbol: "Tswap", decimals: 18 }
];

let provider, signer, userAddress;
let routerContract, factoryContract;

let selectedSwapIn = null, selectedSwapOut = null;
let selectedLiquidityIn = null, selectedLiquidityOut = null;

const decimalCache = {}; // cache decimals, tapi semua 18 default karena ERC20Minimal

// === Inisialisasi ===
async function init() {
  if (!window.ethereum) {
    alert("Please install MetaMask or compatible wallet!");
    return;
  }
  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();

  routerContract = new ethers.Contract(routerAddress, routerAbi, signer);
  factoryContract = new ethers.Contract(factoryAddress, factoryAbi, signer);

  // coba auto connect
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) {
      userAddress = accounts[0];
      updateWalletUI();
      updateAllBalances();
    }
  } catch (e) {
    console.error(e);
  }
  // Event UI connect
  document.getElementById("btnConnect").onclick = connectWallet;

  // Token selection button example
  document.getElementById("tokenInBtn").onclick = () => openTokenSelector("swapIn");
  document.getElementById("tokenOutBtn").onclick = () => openTokenSelector("swapOut");
  document.getElementById("liquidityTokenInBtn").onclick = () => openTokenSelector("liqIn");
  document.getElementById("liquidityTokenOutBtn").onclick = () => openTokenSelector("liqOut");

  document.getElementById("btnSwap").onclick = doSwap;
  document.getElementById("btnAddLiquidity").onclick = addLiquidity;

  document.getElementById("amount").oninput = updateSwapPreview;
  document.getElementById("liquidityAmountA").oninput = updatePriceEstimate;
  document.getElementById("liquidityAmountB").oninput = updatePriceEstimate;

  populateTokenSelector();

  window.ethereum.on("accountsChanged", handleAccountsChanged);
  window.ethereum.on("chainChanged", () => window.location.reload());
}

// === Wallet Connect ===
async function connectWallet() {
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (accounts.length > 0) {
      userAddress = accounts[0];
      updateWalletUI();
      updateAllBalances();
    }
  } catch (e) {
    alert("Failed to connect wallet.");
    console.error(e);
  }
}

function updateWalletUI() {
  document.getElementById("walletStatus").innerText = `Connected: ${shortAddress(userAddress)}`;
  document.getElementById("btnConnect").innerText = "Connected";
}

function resetUI() {
  userAddress = null;
  document.getElementById("walletStatus").innerText = "Not connected";
  document.getElementById("btnConnect").innerText = "Connect Wallet";
}

// === Helpers ===
function shortAddress(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// === Token Selector ===
function populateTokenSelector() {
  const list = document.getElementById("tokenList");
  list.innerHTML = "";
  for (const tok of tokenList) {
    const div = document.createElement("div");
    div.className = "token-item";
    div.dataset.address = tok.address;
    div.dataset.symbol = tok.symbol;
    div.innerText = tok.symbol;
    div.onclick = () => selectToken(tok);
    list.appendChild(div);
  }
}

let activeSelectionType = null;
function openTokenSelector(type) {
  activeSelectionType = type;
  document.getElementById("tokenSelector").style.display = "block";
}
function closeTokenSelector() {
  document.getElementById("tokenSelector").style.display = "none";
}

function selectToken(tok) {
  if ((activeSelectionType === "swapIn" && selectedSwapOut?.address === tok.address) ||
      (activeSelectionType === "swapOut" && selectedSwapIn?.address === tok.address) ||
      (activeSelectionType === "liqIn" && selectedLiquidityOut?.address === tok.address) ||
      (activeSelectionType === "liqOut" && selectedLiquidityIn?.address === tok.address)) {
    alert("Token sudah dipilih di sisi lain");
    return;
  }
  if (activeSelectionType === "swapIn") {
    selectedSwapIn = tok;
    document.getElementById("tokenInBtn").innerText = tok.symbol;
  } else if (activeSelectionType === "swapOut") {
    selectedSwapOut = tok;
    document.getElementById("tokenOutBtn").innerText = tok.symbol;
  } else if (activeSelectionType === "liqIn") {
    selectedLiquidityIn = tok;
    document.getElementById("liquidityTokenInBtn").innerText = tok.symbol;
  } else if (activeSelectionType === "liqOut") {
    selectedLiquidityOut = tok;
    document.getElementById("liquidityTokenOutBtn").innerText = tok.symbol;
  }
  closeTokenSelector();
}

// === Balances ===
async function getBalance(tok) {
  if (!userAddress) return "0.00";
  if (tok.address === "native") {
    const bal = await provider.getBalance(userAddress);
    return parseFloat(ethers.formatEther(bal)).toFixed(4);
  }
  const c = new ethers.Contract(tok.address, ["function balanceOf(address) view returns(uint256)", "function decimals() view returns(uint8)"], provider);
  const [raw, dec] = await Promise.all([c.balanceOf(userAddress), c.decimals()]);
  decimalCache[tok.address] = dec;
  return parseFloat(ethers.formatUnits(raw, dec)).toFixed(4);
}

async function updateAllBalances() {
  for (const tok of tokenList) {
    const bal = await getBalance(tok);
    // Update UI jika ada elemen balance dengan id "bal-{symbol}"
    const el = document.getElementById(`bal-${tok.symbol}`);
    if (el) el.innerText = `Balance: ${bal}`;
  }
}

// === Swap Preview ===
async function updateSwapPreview() {
  if (!selectedSwapIn || !selectedSwapOut) return;
  const val = document.getElementById("amount").value;
  if (!val || isNaN(val) || parseFloat(val) <= 0) {
    document.getElementById("amountOut").value = "";
    return;
  }
  try {
    const amountIn = ethers.parseUnits(val, selectedSwapIn.decimals);
    const amountsOut = await routerContract.getAmountsOut(amountIn, [selectedSwapIn.address, selectedSwapOut.address]);
    document.getElementById("amountOut").value = ethers.formatUnits(amountsOut[1], selectedSwapOut.decimals);
  } catch {
    document.getElementById("amountOut").value = "";
  }
}

// === Slippage ===
function getSlippage() {
  const s = parseFloat(document.getElementById("slippage").value);
  return isNaN(s) ? 1 : s;
}

// === Swap ===
async function doSwap() {
  if (!userAddress) return alert("❌ Connect wallet dulu.");
  if (!selectedSwapIn || !selectedSwapOut) return alert("❗ Pilih token swap in dan out");
  const val = document.getElementById("amount").value;
  if (!val || isNaN(val) || parseFloat(val) <= 0) return alert("⚠️ Jumlah swap tidak valid");

  try {
    const amountIn = ethers.parseUnits(val, selectedSwapIn.decimals);

    // Approve token dulu kalo bukan native
    if (selectedSwapIn.address !== "native") {
      showTxStatusModal("loading", `Meng-approve ${selectedSwapIn.symbol}...`);
      const tokenContract = new ethers.Contract(selectedSwapIn.address, ["function approve(address,uint256) returns(bool)"], signer);
      const txApprove = await tokenContract.approve(routerAddress, amountIn);
      await txApprove.wait();
    }

    const deadline = Math.floor(Date.now() / 1000) + 600;
    showTxStatusModal("loading", "Mengirim transaksi swap...");
    const tx = await routerContract.swapExactTokensForTokens(
      amountIn,
      0, // minAmountOut (bisa ditambahkan logika slippage)
      [selectedSwapIn.address, selectedSwapOut.address],
      userAddress,
      deadline
    );
    await tx.wait();

    showTxStatusModal("success", "Swap berhasil!");
    updateAllBalances();
  } catch (e) {
    console.error(e);
    showTxStatusModal("error", "Gagal swap", e.message || e.reason || "Error tidak diketahui");
    alert("Gagal swap: " + (e.message || e.reason || "Error tidak diketahui"));
  }
}

// === Add Liquidity ===
async function addLiquidity() {
  if (!userAddress) return alert("❌ Connect wallet dulu.");
  if (!selectedLiquidityIn || !selectedLiquidityOut) return alert("❗ Pilih token A dan B untuk liquidity.");
  if (selectedLiquidityIn.address === selectedLiquidityOut.address) return alert("Token A dan B harus berbeda.");

  const amountA = document.getElementById("liquidityAmountA").value;
  const amountB = document.getElementById("liquidityAmountB").value;

  if (!amountA || isNaN(amountA) || parseFloat(amountA) <= 0) return alert("Jumlah token A tidak valid");
  if (!amountB || isNaN(amountB) || parseFloat(amountB) <= 0) return alert("Jumlah token B tidak valid");

  try {
    const decA = selectedLiquidityIn.decimals || 18;
    const decB = selectedLiquidityOut.decimals || 18;

    const amtADesired = ethers.parseUnits(amountA, decA);
    const amtBDesired = ethers.parseUnits(amountB, decB);

    // Approve token A
    showTxStatusModal("loading", `Meng-approve ${selectedLiquidityIn.symbol}...`);
    const tokenAContract = new ethers.Contract(selectedLiquidityIn.address, ["function approve(address,uint256) returns(bool)"], signer);
    const txA = await tokenAContract.approve(routerAddress, amtADesired);
    await txA.wait();

    // Approve token B
    showTxStatusModal("loading", `Meng-approve ${selectedLiquidityOut.symbol}...`);
    const tokenBContract = new ethers.Contract(selectedLiquidityOut.address, ["function approve(address,uint256) returns(bool)"], signer);
    const txB = await tokenBContract.approve(routerAddress, amtBDesired);
    await txB.wait();

    // Cek pair
    let pair = await factoryContract.getPair(selectedLiquidityIn.address, selectedLiquidityOut.address);
    if (!pair || pair === ethers.ZeroAddress) {
      showTxStatusModal("loading", "Membuat pair baru...");
      const txCreate = await factoryContract.createPair(selectedLiquidityIn.address, selectedLiquidityOut.address);
      await txCreate.wait();
      await new Promise(r => setTimeout(r, 3000)); // tunggu pair siap
    }

    // Hitung minimum token dengan slippage (default 1%)
    const slippage = getSlippage();
    const amtAMin = amtADesired * BigInt(100 - slippage) / 100n;
    const amtBMin = amtBDesired * BigInt(100 - slippage) / 100n;

    const deadline = Math.floor(Date.now() / 1000) + 600;

    showTxStatusModal("loading", "Menambahkan liquidity...");
    const txAdd = await routerContract.addLiquidity(
      selectedLiquidityIn.address,
      selectedLiquidityOut.address,
      amtADesired,
      amtBDesired,
      amtAMin,
      amtBMin,
      userAddress
    );
    await txAdd.wait();

    showTxStatusModal("success", "Liquidity berhasil ditambahkan!");
    updateAllBalances();
  } catch (e) {
    console.error(e);
    showTxStatusModal("error", "Gagal add liquidity", e.message || e.reason || "Error tidak diketahui");
    alert("Gagal add liquidity: " + (e.message || e.reason || "Error tidak diketahui"));
  }
}

// === Modal Status Transaksi ===
function showTxStatusModal(status, title, subtitle = "", link = "") {
  const modal = document.getElementById("modalStatusTx");
  if (!modal) return;
  modal.style.display = "block";
  modal.querySelector(".modal-title").innerText = title || "";
  modal.querySelector(".modal-subtitle").innerText = subtitle || "";
  const linkEl = modal.querySelector(".modal-link");
  if (link) {
    linkEl.href = link;
    linkEl.style.display = "inline";
  } else {
    linkEl.style.display = "none";
  }
  const iconEl = modal.querySelector(".modal-icon");
  if (status === "loading") iconEl.textContent = "⏳";
  else if (status === "success") iconEl.textContent = "✅";
  else if (status === "error") iconEl.textContent = "❌";
}

function hideTxStatusModal() {
  const modal = document.getElementById("modalStatusTx");
  if (!modal) return;
  modal.style.display = "none";
}

// === Jalankan init
init();
