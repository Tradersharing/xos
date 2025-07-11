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
const routerAddress = "0xb129536147c0CA420490d6b68d5bb69D7Bc2c151";
const factoryAddress = "0x122D9a2B9D5117377F6b123a727D08A99D4d24b8";

// Minimal ABIs
const routerAbi = [
  "function getAmountsOut(uint,address[]) view returns(uint[])",
  "function swapExactTokensForTokens(uint,uint,address[],address,uint) external returns(uint[])",
  "function swapExactETHForTokens(uint,address[],address,uint) payable external returns(uint[])",
  "function swapExactTokensForETH(uint,uint,address[],address,uint) external returns(uint[])",
  "function addLiquidity(address,address,uint,uint,uint,uint,address,uint) returns(uint,uint,uint)"
];
const factoryAbi = [
  "function getPair(address,address) view returns(address)",
  "function createPair(address,address) returns(address)"
];
const lpAbi = ["function mint(address) returns(uint)"];

// Token List
const tokenList = [
  { address: "native", symbol: "XOS", decimals: 18 },
  { address: "0x0AAB67cf6F2e99847b9A95DeC950B250D648c1BB", symbol: "wXOS", decimals: 18 },
  { address: "0x2CCDB83a043A32898496c1030880Eb2cB977CAbc", symbol: "USDT", decimals: 6 },
  { address: "0xb2C1C007421f0Eb5f4B3b3F38723C309Bb208d7d", symbol: "USDC", decimals: 6 },
  { address: "0xb129536147c0CA420490d6b68d5bb69D7Bc2c151", symbol: "Tswap", decimals: 18 }
];

// Contracts
let routerContract, factoryContract;
let tokenSelector;

// Selected tokens
let selectedSwapIn = null;
let selectedSwapOut = null;
let selectedLiquidityIn = null;
let selectedLiquidityOut = null;

// === Initialization ===
document.addEventListener("DOMContentLoaded", async () => {
  const btnConnect = document.getElementById("btnConnect");
  if (btnConnect) {
    btnConnect.disabled = false;
    btnConnect.addEventListener("click", async () => {
      if (!window.ethereum) {
        alert("MetaMask atau wallet Web3 tidak ditemukan. Silakan install terlebih dahulu.");
        return;
      }
      try {
        await connectWallet();
      } catch (e) {
        console.error("Connect wallet error:", e);
      }
    });
  }

  if (!window.ethereum) {
    alert("MetaMask atau wallet Web3 belum terpasang. Silakan install terlebih dahulu.");
    disableAllWeb3Features();
    return;
  }

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  routerContract = new ethers.Contract(routerAddress, routerAbi, signer);
  factoryContract = new ethers.Contract(factoryAddress, factoryAbi, signer);

  tokenSelector = document.getElementById("tokenSelector");

  await ensureCorrectChain();
  await tryAutoConnect();

  document.getElementById("tokenInBtn")?.addEventListener("click", () => openTokenSelector("swapIn"));
  document.getElementById("tokenOutBtn")?.addEventListener("click", () => openTokenSelector("swapOut"));
  document.getElementById("liquidityTokenInBtn")?.addEventListener("click", () => openTokenSelector("liqIn"));
  document.getElementById("liquidityTokenOutBtn")?.addEventListener("click", () => openTokenSelector("liqOut"));
  document.getElementById("amount")?.addEventListener("input", updateSwapPreview);
  document.getElementById("btnSwap")?.addEventListener("click", doSwap);
  document.getElementById("btnAddLiquidity")?.addEventListener("click", addLiquidity);

  document.querySelectorAll(".tab-bar button").forEach(btn => {
    btn.addEventListener("click", () => switchPage(btn));
  });

  window.addEventListener("click", e => {
    if (e.target === tokenSelector) tokenSelector.classList.add("hidden");
  });

  populateTokenDropdowns();

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", (accounts) => {
      if (accounts.length === 0) {
        userAddress = null;
        resetUI();
      } else {
        userAddress = accounts[0];
        updateWalletUI();
        updateAllBalances();
      }
    });
    window.ethereum.on("chainChanged", () => {
      window.location.reload();
    });
  }
});

// === Disable semua fitur Web3 saat wallet tidak tersedia ===
function disableAllWeb3Features() {
  document.getElementById("btnConnect").disabled = true;
  ["stakingBtn", "faucetBtn", "lpBtn"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
  const status = document.getElementById("walletStatus");
  if (status) status.innerText = "Wallet Web3 tidak ditemukan, silakan install MetaMask.";
}

// === Chain & Connection ===
async function ensureCorrectChain() {
  if (!window.ethereum) return;
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (chainId !== CHAIN_ID_HEX) {
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
    } catch (e) {
      if (e.code === 4902) {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [XOS_PARAMS] });
      } else console.error(e);
    }
  }
}

async function tryAutoConnect() {
  if (!window.ethereum) return;
  try {
    const accounts = await provider.send("eth_accounts", []);
    if (accounts.length > 0) {
      userAddress = accounts[0];
      signer = await provider.getSigner();
      updateWalletUI();
      updateAllBalances();
    } else {
      resetUI();
    }
  } catch (e) {
    console.error("Auto connect error:", e);
    resetUI();
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    alert("MetaMask atau wallet Web3 tidak ditemukan. Silakan install terlebih dahulu.");
    return;
  }
  try {
    const accounts = await provider.send("eth_requestAccounts", []);
    if (accounts.length > 0) {
      userAddress = accounts[0];
      signer = await provider.getSigner();
      updateWalletUI();
      updateAllBalances();
    } else {
      resetUI();
    }
  } catch (e) {
    console.error("Connect wallet failed:", e);
    resetUI();
  }
}

function updateWalletUI() {
  const status = document.getElementById("walletStatus");
  if (status) status.innerText = `Connected: ${shortenAddress(userAddress)}`;

  const btn = document.getElementById("btnConnect");
  if (btn) {
    btn.innerText = "Connected";
    btn.disabled = true;
  }

  ["stakingBtn", "faucetBtn", "lpBtn"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });

  // Enable swap & liquidity buttons
  const swapBtn = document.getElementById("btnSwap");
  const lpBtn = document.getElementById("btnAddLiquidity");
  if (swapBtn) swapBtn.disabled = false;
  if (lpBtn) lpBtn.disabled = false;
}

function resetUI() {
  userAddress = null;

  const status = document.getElementById("walletStatus");
  if (status) status.innerText = "Not connected";

  const btn = document.getElementById("btnConnect");
  if (btn) {
    btn.innerText = "Connect Wallet";
    btn.disabled = false;
  }

  ["stakingBtn", "faucetBtn", "lpBtn"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });

  // Disable swap & liquidity buttons
  const swapBtn = document.getElementById("btnSwap");
  const lpBtn = document.getElementById("btnAddLiquidity");
  if (swapBtn) swapBtn.disabled = true;
  if (lpBtn) lpBtn.disabled = true;
}

function shortenAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// === Token Selector ===
function openTokenSelector(type) {
  activeSelectionType = type;
  tokenSelector.classList.remove("hidden");
  tokenSelector.style.display = "flex";
}

function closeTokenSelector() {
  tokenSelector.classList.add("hidden");
  tokenSelector.style.display = "none";
}

function populateTokenDropdowns() {
  const list = document.getElementById("tokenList");
  if (!list) return;
  list.innerHTML = "";
  tokenList.forEach(tok => {
    const div = document.createElement("div");
    div.className = "token-item";
    div.dataset.address = tok.address;
    div.dataset.symbol = tok.symbol;
    div.innerHTML = `
      <div class='token-balance' id='bal-${tok.symbol}'>⏳</div>
      <div class='token-symbol'>${tok.symbol}</div>
    `;
    div.onclick = () => selectToken(tok);
    list.appendChild(div);
    getBalance(tok).then(b => {
      const e = document.getElementById(`bal-${tok.symbol}`);
      if (e) e.innerText = `Balance: ${b}`;
    });
  });
}

async function getBalance(tok) {
  if (!userAddress) return "0.00";
  if (tok.address === "native") {
    const b = await provider.getBalance(userAddress);
    return parseFloat(ethers.formatEther(b)).toFixed(4);
  }
  const c = new ethers.Contract(tok.address, ["function balanceOf(address) view returns(uint256)", "function decimals() view returns(uint8)"], provider);
  const [raw, dec] = await Promise.all([c.balanceOf(userAddress), c.decimals()]);
  return parseFloat(ethers.formatUnits(raw, dec)).toFixed(4);
}

function selectToken(tok) {
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
  const mapping = {
    swapIn: { btn: "tokenInBtn", bal: "tokenInBalance" },
    swapOut: { btn: "tokenOutBtn", bal: "tokenOutBalance" },
    liqIn: { btn: "liquidityTokenInBtn", bal: "liquidityTokenInBalance" },
    liqOut: { btn: "liquidityTokenOutBtn", bal: "liquidityTokenOutBalance" }
  };
  const ids = mapping[activeSelectionType];
  const btn = document.getElementById(ids.btn);
  getBalance(tok).then(bal => {
    btn.innerHTML = `<div class='token-balance-display'>Balance: ${bal}</div><div class='token-symbol'>${tok.symbol}</div>`;
    const balElem = document.getElementById(ids.bal);
    if (balElem) balElem.innerText = `Balance: ${bal}`;
  });
}

// === Swap Preview ===
async function updateSwapPreview() {
  const amtInElem = document.getElementById("amount");
  const amtOutElem = document.getElementById("amountOut");
  if (!selectedSwapIn || !selectedSwapOut) return;
  const val = amtInElem.value;
  if (!val || isNaN(val)) return amtOutElem.value = "";
  const inWei = ethers.parseUnits(val, selectedSwapIn.decimals);
  try {
    const amounts = await routerContract.getAmountsOut(inWei, [selectedSwapIn.address, selectedSwapOut.address]);
    amtOutElem.value = ethers.formatUnits(amounts[1], selectedSwapOut.decimals);
  } catch (e) {
    amtOutElem.value = "";
    console.error("Preview error:", e);
  }
}

async function doSwap() {
  try {
    if (!selectedSwapIn || !selectedSwapOut) return alert("Pilih token swap in/out");
    const val = document.getElementById("amount").value;
    if (!val || isNaN(val)) return alert("Isi jumlah yang valid");
    const inWei = ethers.parseUnits(val, selectedSwapIn.decimals);

    const balance = await getBalance(selectedSwapIn);
    if (parseFloat(val) > parseFloat(balance)) return alert("Jumlah melebihi saldo");

    if (selectedSwapIn.address !== "native") {
      await new ethers.Contract(selectedSwapIn.address, ["function approve(address,uint256) returns(bool)"], signer)
        .approve(routerAddress, inWei);
    }
    const path = [selectedSwapIn.address, selectedSwapOut.address];
    const tx = await routerContract.swapExactTokensForTokens(inWei, 0, path, userAddress, Math.floor(Date.now()/1000)+600);
    await tx.wait();
    alert("Swap sukses");
    updateAllBalances();
  } catch (err) {
    console.error("Swap error:", err);
    alert("Swap gagal: " + err.message);
  }
}

// === Add Liquidity ===
async function addLiquidity() {
  console.log("🔁 Klik tombol addLiquidity");

  const statusEl = document.getElementById("liquidityStatus");
  const loadingEl = document.getElementById("liquidityLoading");

  try {
    statusEl.innerHTML = "";
    loadingEl.innerHTML = "⏳ Menunggu konfirmasi...";
    loadingEl.style.display = "block";

    if (!selectedLiquidityIn || !selectedLiquidityOut) {
      alert("Pilih token liquidity A/B");
      return;
    }

    let aVal = document.getElementById("liquidityAmountA").value;
    let bVal = document.getElementById("liquidityAmountB").value;

    if ((!aVal || isNaN(aVal)) && (!bVal || isNaN(bVal))) {
      alert("Isi setidaknya satu jumlah (A atau B)");
      return;
    }

    const symbolA = selectedLiquidityIn.symbol.toUpperCase();
    const symbolB = selectedLiquidityOut.symbol.toUpperCase();

    const isUsdtTswap = (symbolA === "USDT" && symbolB === "TSWAP") || (symbolA === "TSWAP" && symbolB === "USDT");

    if (isUsdtTswap) {
      if (symbolA === "USDT" && aVal && (!bVal || isNaN(bVal))) {
        bVal = (parseFloat(aVal) / 0.001).toString();
        document.getElementById("liquidityAmountB").value = bVal;
      }
      if (symbolB === "USDT" && bVal && (!aVal || isNaN(aVal))) {
        aVal = (parseFloat(bVal) / 0.001).toString();
        document.getElementById("liquidityAmountA").value = aVal;
      }
    }

    if (!aVal || !bVal || isNaN(aVal) || isNaN(bVal)) {
      alert("Masukkan jumlah valid");
      return;
    }

    const amtA = ethers.parseUnits(aVal, selectedLiquidityIn.decimals);
    const amtB = ethers.parseUnits(bVal, selectedLiquidityOut.decimals);

    // Approve Token A
    if (selectedLiquidityIn.address !== "native") {
      const tokenA = new ethers.Contract(selectedLiquidityIn.address, ["function approve(address,uint256) returns(bool)"], signer);
      loadingEl.innerHTML = "✅ Signature Token A";
      const txA = await tokenA.approve(routerAddress, ethers.MaxUint256);
      await txA.wait();
    }

    // Approve Token B
    if (selectedLiquidityOut.address !== "native") {
      const tokenB = new ethers.Contract(selectedLiquidityOut.address, ["function approve(address,uint256) returns(bool)"], signer);
      loadingEl.innerHTML = "✅ Signature Token B";
      const txB = await tokenB.approve(routerAddress, ethers.MaxUint256);
      await txB.wait();
    }

    // Add Liquidity
    loadingEl.innerHTML = "🚀 Mengirim TX addLiquidity...";
    const tx = await routerContract.addLiquidity(
      selectedLiquidityIn.address,
      selectedLiquidityOut.address,
      amtA,
      amtB,
      0, 0,
      userAddress,
      Math.floor(Date.now() / 1000) + 600
    );
    await tx.wait();

    loadingEl.style.display = "none";
    statusEl.innerHTML = `<span style="color:limegreen;">✅ Liquidity sukses!</span>`;
    updateAllBalances();
  } catch (e) {
    console.error("Liquidity error:", e);
    loadingEl.style.display = "none";
    statusEl.innerHTML = `<span style="color:red;">❌ Gagal:<br>${e.message || e.toString()}</span>`;
  }
}



// === Balance Refresh ===
async function updateAllBalances() {
  for (let tok of tokenList) {
    const bal = await getBalance(tok);
    const balEl = document.getElementById(`bal-${tok.symbol}`);
    if (balEl) balEl.innerText = `Balance: ${bal}`;
  }
}

// === Tab Switch ===
function switchPage(btn) {
  document.querySelectorAll(".tab-bar button").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  const target = btn.dataset.target;
  document.getElementById(target).classList.add("active");
}
