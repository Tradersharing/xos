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

// Contracts instantiation
let routerContract;
let factoryContract;

// Popup selector element
let tokenSelector;

// Selected tokens
let selectedSwapIn = null;
let selectedSwapOut = null;
let selectedLiquidityA = null;
let selectedLiquidityB = null;

// === Initialization ===
window.addEventListener("DOMContentLoaded", async () => {
  // Provider & signer via ethers.js
  if (!window.ethereum) {
    alert("Please install MetaMask or OKX Wallet");
    return;
  }
  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  routerContract = new ethers.Contract(routerAddress, routerAbi, signer);
  factoryContract = new ethers.Contract(factoryAddress, factoryAbi, signer);

  tokenSelector = document.getElementById("tokenSelector");

  // Check initial chain
  await ensureCorrectChain();
  // Check wallet connection
  await checkWalletConnection();

  // Button listeners
  document.getElementById("btnConnect").onclick = connectWallet;
  document.getElementById("swapTokenInBtn").onclick = () => openTokenSelector("swapIn");
  document.getElementById("swapTokenOutBtn").onclick = () => openTokenSelector("swapOut");
  document.getElementById("liquidityTokenABtn").onclick = () => openTokenSelector("liqA");
  document.getElementById("liquidityTokenBBtn").onclick = () => openTokenSelector("liqB");
  document.getElementById("swapAmount").addEventListener("input", updateSwapPreview);
  document.getElementById("liquidityAmountA").addEventListener("input", updateLiquidityPreview);
  document.getElementById("liquidityAmountB").addEventListener("input", updateLiquidityPreview);
  document.getElementById("btnSwap").onclick = doSwap;
  document.getElementById("btnAddLiq").onclick = addLiquidity;

  // Tab switching
  document.querySelectorAll(".tab-bar button").forEach(btn => btn.onclick = () => switchPage(btn));

  // Click outside popup to close
  window.onclick = e => { if (e.target === tokenSelector) tokenSelector.classList.add("hidden"); };

  // Populate token list in popup
  populateTokenDropdowns();
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
      } else {
        console.error(e);
      }
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
  status.innerText = `Connected: ${shortenAddress(userAddress)}`;
  document.getElementById("btnConnect").innerText = "Connected";
}

function shortenAddress(addr) {
  return addr.slice(0,6) + "..." + addr.slice(-4);
}

// === Token Selector Popup ===
function openTokenSelector(type) {
  activeSelectionType = type;
  tokenSelector.classList.remove("hidden");
}

function populateTokenDropdowns() {
  tokenSelector.innerHTML = "";
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
    tokenSelector.appendChild(div);
    // fetch balance
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
  // assign based on popup context
  if (activeSelectionType === "swapIn") selectedSwapIn = tok;
  if (activeSelectionType === "swapOut") selectedSwapOut = tok;
  if (activeSelectionType === "liqA") selectedLiquidityA = tok;
  if (activeSelectionType === "liqB") selectedLiquidityB = tok;
  // update button UI
  updateSelectionUI(tok);
  tokenSelector.classList.add("hidden");
}

function updateSelectionUI(tok) {
  let btnId;
  if (selectedSwapIn === tok) btnId = "swapTokenInBtn";
  if (selectedSwapOut === tok) btnId = "swapTokenOutBtn";
  if (selectedLiquidityA === tok) btnId = "liquidityTokenABtn";
  if (selectedLiquidityB === tok) btnId = "liquidityTokenBBtn";
  if (!btnId) return;
  const btn = document.getElementById(btnId);
  getBalance(tok).then(bal => {
    btn.innerHTML = `<div class='token-balance-display'>Balance: ${bal}</div><div class='token-symbol'>${tok.symbol}</div>`;
  });
}

// === Swap Preview & Execution ===
async function updateSwapPreview() {
  const amtInElem = document.getElementById("swapAmount");
  const amtOutElem = document.getElementById("swapAmountOut");
  if (!selectedSwapIn || !selectedSwapOut) return;
  const val = amtInElem.value;
  if (!val || isNaN(val)) { amtOutElem.value = ""; return; }
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
  const val = document.getElementById("swapAmount").value;
  const inWei = ethers.parseUnits(val, selectedSwapIn.decimals);
  // approve if needed
  if (selectedSwapIn.address !== "native") {
    const c = new ethers.Contract(selectedSwapIn.address, ["function approve(address,uint256) returns(bool)"], signer);
    await c.approve(routerAddress, inWei);
  }
  const path = [selectedSwapIn.address, selectedSwapOut.address];
  const tx = await routerContract.swapExactTokensForTokens(inWei, 0, path, userAddress, Math.floor(Date.now()/1000)+600);
  await tx.wait();
  alert("Swap sukses");
  // refresh balances
  updateAllBalances();
}

// === Add Liquidity Preview & Execution ===
async function updateLiquidityPreview() {
  const aEl = document.getElementById("liquidityAmountA");
  const bEl = document.getElementById("liquidityAmountB");
  if (!selectedLiquidityA || !selectedLiquidityB) return;
  const valA = aEl.value;
  const valB = bEl.value;
  if (valA && !valB) {
    const wA = ethers.parseUnits(valA, selectedLiquidityA.decimals);
    const out = await routerContract.getAmountsOut(wA, [selectedLiquidityA.address, selectedLiquidityB.address]);
    bEl.value = ethers.formatUnits(out[1], selectedLiquidityB.decimals);
  } else if (valB && !valA) {
    const wB = ethers.parseUnits(valB, selectedLiquidityB.decimals);
    const out = await routerContract.getAmountsOut(wB, [selectedLiquidityB.address, selectedLiquidityA.address]);
    aEl.value = ethers.formatUnits(out[1], selectedLiquidityA.decimals);
  }
}

async function addLiquidity() {
  if (!selectedLiquidityA || !selectedLiquidityB) return alert("Pilih token liquidity A/B");
  const aVal = document.getElementById("liquidityAmountA").value;
  const bVal = document.getElementById("liquidityAmountB").value;
  const amtA = ethers.parseUnits(aVal, selectedLiquidityA.decimals);
  const amtB = ethers.parseUnits(bVal, selectedLiquidityB.decimals);
  // approve both
  if (selectedLiquidityA.address !== "native") {
    await new ethers.Contract(selectedLiquidityA.address, ["function approve(address,uint256) returns(bool)"], signer)
      .approve(routerAddress, amtA);
  }
  if (selectedLiquidityB.address !== "native") {
    await new ethers.Contract(selectedLiquidityB.address, ["function approve(address,uint256) returns(bool)"], signer)
      .approve(routerAddress, amtB);
  }
  // call router.addLiquidity
  const tx = await routerContract.addLiquidity(
    selectedLiquidityA.address,
    selectedLiquidityB.address,
    amtA, amtB,
    0, 0,
    userAddress,
    Math.floor(Date.now()/1000) + 600
  );
  await tx.wait();
  alert("Add Liquidity sukses");
  updateAllBalances();
}

// === Utility: Update All Balances ===
async function updateAllBalances() {
  for (let tok of tokenList) {
    await getBalance(tok); // triggers UI update in populate
  }
}

// === Tab Switch ===
function switchPage(btn) {
  document.querySelectorAll(".tab-bar button").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  btn.classList.add("active");
  const target = btn.dataset.target;
  document.getElementById(target).classList.add("active");
}
