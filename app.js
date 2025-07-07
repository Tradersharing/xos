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
window.addEventListener("DOMContentLoaded", async () => {
  if (!window.ethereum) return alert("Please install MetaMask or OKX Wallet");

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  routerContract = new ethers.Contract(routerAddress, routerAbi, signer);
  factoryContract = new ethers.Contract(factoryAddress, factoryAbi, signer);

  tokenSelector = document.getElementById("tokenSelector");

  await ensureCorrectChain();
  await checkWalletConnection();

  document.getElementById("btnConnect").onclick = connectWallet;
  document.getElementById("tokenInBtn").onclick = () => openTokenSelector("swapIn");
  document.getElementById("tokenOutBtn").onclick = () => openTokenSelector("swapOut");
  document.getElementById("liquidityTokenInBtn").onclick = () => openTokenSelector("liqIn");
  document.getElementById("liquidityTokenOutBtn").onclick = () => openTokenSelector("liqOut");
  document.getElementById("amount").addEventListener("input", updateSwapPreview);
  document.getElementById("btnSwap").onclick = doSwap;
  document.getElementById("btnAddLiquidity").onclick = addLiquidity;

  document.querySelectorAll(".tab-bar button").forEach(btn => {
    const target = btn.getAttribute("onclick")?.match(/'(.+?)'/)?.[1];
    if (target) btn.dataset.target = target;
    btn.onclick = () => switchPage(btn);
  });

  window.onclick = e => { if (e.target === tokenSelector) tokenSelector.classList.add("hidden"); };

  populateTokenDropdowns();
});

// === Tambahan: Close selector jika klik luar ===
document.addEventListener("click", e => {
  if (!tokenSelector.contains(e.target) && !e.target.closest(".token-item")) {
    tokenSelector.classList.add("hidden");
  }
});

// === Chain & Connection ===
async function ensureCorrectChain() {
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

async function checkWalletConnection() {
  const accounts = await provider.send("eth_accounts", []);
  if (accounts.length > 0) {
    userAddress = accounts[0];
    updateWalletUI();
    updateAllBalances();
  }
}

async function connectWallet() {
  try {
    const accounts = await provider.send("eth_requestAccounts", []);
    userAddress = accounts[0];
    updateWalletUI();
    updateAllBalances();
  } catch (e) {
    console.error("Failed connect", e);
  }
}

function updateWalletUI() {
  const status = document.getElementById("walletStatus");
  if (status) status.innerText = `Connected: ${shortenAddress(userAddress)}`;
  document.getElementById("btnConnect").innerText = "Connected";
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
  const list = document.getElementById("tokenList");
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
      if(e) e.innerText = `Balance: ${b}`;
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
  }
}

async function doSwap() {
  if (!selectedSwapIn || !selectedSwapOut) return alert("Pilih token swap in/out");
  const val = document.getElementById("amount").value;
  const inWei = ethers.parseUnits(val, selectedSwapIn.decimals);
  if (selectedSwapIn.address !== "native") {
    await new ethers.Contract(selectedSwapIn.address, ["function approve(address,uint256) returns(bool)"], signer)
      .approve(routerAddress, inWei);
  }
  const path = [selectedSwapIn.address, selectedSwapOut.address];
  const tx = await routerContract.swapExactTokensForTokens(inWei, 0, path, userAddress, Math.floor(Date.now()/1000)+600);
  await tx.wait();
  alert("Swap sukses");
  updateAllBalances();
}

// === Add Liquidity ===
async function addLiquidity() {
  if (!selectedLiquidityIn || !selectedLiquidityOut) return alert("Pilih token liquidity A/B");
  const aVal = prompt("Jumlah Token A");
  const bVal = prompt("Jumlah Token B");
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
// Function to open the token selector and activate popup
function openTokenSelector(type) {
  activeSelectionType = type;
  tokenSelector.classList.remove("hidden");
  // Show the token popup
  const popup = document.getElementById("tokenPopup");
  if (popup) {
    popup.style.display = "block";
  }
}

// Function to close the token selector and hide the popup
function closeTokenSelector() {
  tokenSelector.classList.add("hidden");
  const popup = document.getElementById("tokenPopup");
  if (popup) {
    popup.style.display = "none";
  }
}

// Function to update the popup with the selected token details
function updateSelectionUI(tok) {
  const popup = document.getElementById("tokenPopup");
  if (popup) {
    popup.innerHTML = `
      <h3>Selected Token: ${tok.symbol}</h3>
      <p>Address: ${tok.address}</p>
      <p>Balance: ${await getBalance(tok)}</p>
    `;
  }

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

