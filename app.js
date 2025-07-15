// === Setup & Imports ===
const routerAddress = "0x08b154359d5e6d4c7f4c8a1f3e4a2a345fc25a4e"; // alamat deploy mu
const factoryAddress = "0xc5a5febb72028eb2b2c7410473f77582f7deb90a"; // alamat deploy mu

const routerAbi = [
  "function addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256) returns (uint256,uint256,uint256)",
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

const decimalCache = {};

// === Init ===
async function init() {
  if (!window.ethereum) {
    alert("Install MetaMask dulu bro.");
    return;
  }
  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();

  routerContract = new ethers.Contract(routerAddress, routerAbi, signer);
  factoryContract = new ethers.Contract(factoryAddress, factoryAbi, signer);

  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  if (accounts.length) {
    userAddress = accounts[0];
    updateWalletUI();
    updateAllBalances();
  }

  bindEvents();

  window.ethereum.on("accountsChanged", handleAccountsChanged);
  window.ethereum.on("chainChanged", () => location.reload());
}

function bindEvents() {
  document.getElementById("btnConnect").onclick = connectWallet;

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
}

// === Connect Wallet ===
async function connectWallet() {
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (accounts.length) {
      userAddress = accounts[0];
      updateWalletUI();
      updateAllBalances();
    }
  } catch {
    alert("Gagal connect wallet");
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

function shortAddress(addr) {
  return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "";
}

// === Token Selector ===
function populateTokenSelector() {
  const list = document.getElementById("tokenList");
  list.innerHTML = "";
  for (const t of tokenList) {
    const div = document.createElement("div");
    div.className = "token-item";
    div.dataset.address = t.address;
    div.dataset.symbol = t.symbol;
    div.innerText = t.symbol;
    div.onclick = () => selectToken(t);
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
  if (
    (activeSelectionType === "swapIn" && selectedSwapOut?.address === tok.address) ||
    (activeSelectionType === "swapOut" && selectedSwapIn?.address === tok.address) ||
    (activeSelectionType === "liqIn" && selectedLiquidityOut?.address === tok.address) ||
    (activeSelectionType === "liqOut" && selectedLiquidityIn?.address === tok.address)
  ) {
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

  updateAllBalances();
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
  if (!userAddress) return;
  if (selectedSwapIn) {
    const bal = await getBalance(selectedSwapIn);
    document.getElementById("tokenInBalance").innerText = `Balance: ${bal}`;
  }
  if (selectedSwapOut) {
    const bal = await getBalance(selectedSwapOut);
    document.getElementById("tokenOutBalance").innerText = `Balance: ${bal}`;
  }
  if (selectedLiquidityIn) {
    const bal = await getBalance(selectedLiquidityIn);
    document.getElementById("liquidityTokenInBalance").innerText = `Balance: ${bal}`;
  }
  if (selectedLiquidityOut) {
    const bal = await getBalance(selectedLiquidityOut);
    document.getElementById("liquidityTokenOutBalance").innerText = `Balance: ${bal}`;
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
    if (selectedSwapIn.address === "native" || selectedSwapOut.address === "native") {
      document.getElementById("amountOut").value = "N/A";
      return;
    }
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
  if (selectedSwapIn.address === "native" || selectedSwapOut.address === "native")
    return alert("Swap dengan native token belum didukung.");

  const val = document.getElementById("amount").value;
  if (!val || isNaN(val) || parseFloat(val) <= 0) return alert("⚠️ Jumlah swap tidak valid");

  try {
    const amountIn = ethers.parseUnits(val, selectedSwapIn.decimals);

    showTxStatusModal("loading", `Meng-approve ${selectedSwapIn.symbol}...`);
    const tokenContract = new ethers.Contract(selectedSwapIn.address, ["function approve(address,uint256) returns(bool)"], signer);
    const txApprove = await tokenContract.approve(routerAddress, amountIn);
    await txApprove.wait();

    const deadline = Math.floor(Date.now() / 1000) + 600;
    showTxStatusModal("loading", "Mengirim transaksi swap...");
    const tx = await routerContract.swapExactTokensForTokens(
      amountIn,
      0,
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

// === Price Estimate ===
function updatePriceEstimate() {
  const a = document.getElementById("liquidityAmountA").value;
  const b = document.getElementById("liquidityAmountB").value;
  const priceBox = document.getElementById("priceEstimateBox");
  const priceLoading = document.getElementById("priceEstimateLoading");
  const priceResult = document.getElementById("priceEstimateResult");
  const priceInfoText = document.getElementById("priceInfoText");

  if (!a || !b || isNaN(a) || isNaN(b) || a <= 0 || b <= 0) {
    priceBox.style.display = "none";
    return;
  }

  priceBox.style.display = "block";
  priceLoading.style.display = "none";
  priceResult.style.display = "block";

  const price = parseFloat(b) / parseFloat(a);
  priceInfoText.innerText = `Estimasi harga: 1 ${selectedLiquidityIn?.symbol || "Token A"} = ${price.toFixed(6)} ${selectedLiquidityOut?.symbol || "Token B"}`;
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

    showTxStatusModal("loading", `Meng-approve ${selectedLiquidityIn.symbol}...`);
    const tokenAContract = new ethers.Contract(selectedLiquidityIn.address, ["function approve(address,uint256) returns(bool)"], signer);
    const txA = await tokenAContract.approve(routerAddress, amtADesired);
    await txA.wait();

    showTxStatusModal("loading", `Meng-approve ${selectedLiquidityOut.symbol}...`);
    const tokenBContract = new ethers.Contract(selectedLiquidityOut.address, ["function approve(address,uint256) returns(bool)"], signer);
    const txB = await tokenBContract.approve(routerAddress, amtBDesired);
    await txB.wait();

    let pair = await factoryContract.getPair(selectedLiquidityIn.address, selectedLiquidityOut.address);
    if (!pair || pair === ethers.ZeroAddress) {
      showTxStatusModal("loading", "Membuat pair baru...");
      const txCreate = await factoryContract.createPair(selectedLiquidityIn.address, selectedLiquidityOut.address);
      await txCreate.wait();
      await new Promise(r => setTimeout(r, 3000));
    }

    const slippage = getSlippage();
    const slippageFactor = BigInt(Math.floor(100 - slippage));
    const amtAMin = (amtADesired * slippageFactor) / 100n;
    const amtBMin = (amtBDesired * slippageFactor) / 100n;

    const deadline = Math.floor(Date.now() / 1000) + 600;

    showTxStatusModal("loading", "Menambahkan liquidity...");
    const txAdd = await routerContract.addLiquidity(
      selectedLiquidityIn.address,
      selectedLiquidityOut.address,
      amtADesired,
      amtBDesired,
      amtAMin,
      amtBMin,
      userAddress,
      deadline
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

// === Modal ===
function showTxStatusModal(status, title, subtitle = "", link = "") {
  const modal = document.getElementById("modalStatusTx");
  if (!modal) return;
  modal.style.display = "block";
  modal.querySelector(".modal-title").innerText = title;
  modal.querySelector(".modal-subtitle").innerText = subtitle;
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

// === Account change ===
async function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    resetUI();
  } else {
    userAddress = accounts[0];
    updateWalletUI();
    updateAllBalances();
  }
}

init();
