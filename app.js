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
  { address: "0xb129536147c0CA420490d6b68d5bb69D7Bc2c151", symbol: "TSR", decimals: 18 }
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
  // UPDATED: tombol Connect Wallet selalu aktif
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

  // Inisialisasi provider dan signer hanya jika wallet tersedia
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

  // UPDATED: event listeners untuk account & chain changes
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
    window.ethereum.on("chainChanged", (chainId) => {
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

// UPDATED: auto connect wallet jika sebelumnya sudah connect
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

// UPDATED: fungsi connect wallet manual
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

// UPDATED: update UI lebih lengkap
function updateWalletUI() {
  const status = document.getElementById("walletStatus");
  if (status) status.innerText = `Connected: ${shortenAddress(userAddress)}`;

  const btn = document.getElementById("btnConnect");
  if (btn) {
    btn.innerText = "Connected";
    btn.disabled = true;
  }

  // Enable fitur lain yang butuh wallet
  ["stakingBtn", "faucetBtn", "lpBtn"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
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

  // Disable fitur lain saat belum connect
  ["stakingBtn", "faucetBtn", "lpBtn"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
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
  // Prevent selecting same token
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
  try {
    if (!selectedLiquidityIn || !selectedLiquidityOut) return alert("Pilih token liquidity A/B");
    const aVal = prompt("Jumlah Token A");
    const bVal = prompt("Jumlah Token B");
    if (!aVal || !bVal || isNaN(aVal) || isNaN(bVal)) return alert("Masukkan jumlah valid");
    const amtA = ethers.parseUnits(aVal, selectedLiquidityIn.decimals);
    const amtB = ethers.parseUnits(bVal, selectedLiquidityOut.decimals);
    if (selectedLiquidityIn.address !== "native") {
      await new ethers.Contract(selectedLiquidityIn.address, ["function approve(address,uint256) returns(bool)"], signer)
        .approve(routerAddress, amtA);
    }
    if (selectedLiquidityOut.address !== "native") {
      await new ethers.Contract(selectedLiquidityOut.address, ["function approve(address,uint256) returns(bool)"], signer)
        .approve(routerAddress, amtB);
    }
    const tx = await routerContract.addLiquidity(
      selectedLiquidityIn.address,
      selectedLiquidityOut.address,
      amtA, amtB,
      0, 0,
      userAddress,
      Math.floor(Date.now()/1000) + 600
    );
    await tx.wait();
    alert("Add Liquidity sukses");
    updateAllBalances();
  } catch (e) {
    console.error("Liquidity error:", e);
    alert("Gagal tambah liquidity: " + e.message);
  }
}

// === Balance Refresh ===
async function updateAllBalances() {
  for (let tok of tokenList) {
    await getBalance(tok);
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
