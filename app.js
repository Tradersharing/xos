// Constants & Setup
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

// Token List
const tokenList = [
  { address: "native", symbol: "XOS", decimals: 18 },
  { address: "0x0AAB67cf6F2e99847b9A95DeC950B250D648c1BB", symbol: "wXOS", decimals: 18 },
  { address: "0x2CCDB83a043A32898496c1030880Eb2cB977CAbc", symbol: "USDT", decimals: 18 },
  { address: "0xb2C1C007421f0Eb5f4B3b3F38723C309Bb208d7d", symbol: "USDC", decimals: 18 },
  { address: "0xb129536147c0CA420490d6b68d5bb69D7Bc2c151", symbol: "Tswap", decimals: 18 }
];

// Contracts & Selectors
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
        alert("MetaMask atau wallet Web3 tidak ditemukan.");
        return;
      }
      try {
        await connectWallet();
      } catch (e) {
        console.error(e);
      }
    });
  }

  if (!window.ethereum) {
    alert("MetaMask atau wallet Web3 belum terpasang.");
    return;
  }

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();

  routerContract = new ethers.Contract(routerAddress, routerAbi, signer);
  factoryContract = new ethers.Contract(factoryAddress, factoryAbi, signer);

  tokenSelector = document.getElementById("tokenSelector");

  await ensureCorrectChain();
  await tryAutoConnect(); // <-- Ini yang otomatis aktifkan UI jika sudah login wallet

  // Semua tombol & input aktif
  document.getElementById("tokenInBtn").addEventListener("click", () => openTokenSelector("swapIn"));
  document.getElementById("tokenOutBtn").addEventListener("click", () => openTokenSelector("swapOut"));
  document.getElementById("liquidityTokenInBtn").addEventListener("click", () => openTokenSelector("liqIn"));
  document.getElementById("liquidityTokenOutBtn").addEventListener("click", () => openTokenSelector("liqOut"));
  document.getElementById("amount").addEventListener("input", updateSwapPreview);
  document.getElementById("btnSwap").addEventListener("click", doSwap);
  document.getElementById("btnAddLiquidity").addEventListener("click", addLiquidity);

  document.querySelectorAll(".tab-bar button").forEach(btn => btn.addEventListener("click", () => switchPage(btn)));
  window.addEventListener("click", e => {
    if (e.target === tokenSelector) tokenSelector.classList.add("hidden");
  });

  populateTokenDropdowns();

  // Wallet events
  window.ethereum.on("accountsChanged", handleAccountsChanged);
  window.ethereum.on("chainChanged", () => window.location.reload());
});




// === Functions ===
async function ensureCorrectChain() {
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (chainId !== CHAIN_ID_HEX) {
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
    } catch (e) {
      if (e.code === 4902) {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [XOS_PARAMS] });
      }
    }
  }
}

async function tryAutoConnect() {
  try {
    console.log("🔍 Mencoba auto-connect...");

    const accounts = await window.ethereum.request({ method: "eth_accounts" });

    if (accounts.length > 0) {
      console.log("✅ Wallet sudah connect:", accounts[0]);

      userAddress = accounts[0];
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();

      updateWalletUI(); // ⬅️ seharusnya ini mengubah tombol & status
      updateAllBalances();
    } else {
      console.log("❌ Belum connect");
      resetUI();
    }
  } catch (err) {
    console.error("❌ Error auto-connect:", err);
    resetUI();
  }
}

//====

function updateWalletUI() {
  console.log("🔄 updateWalletUI dipanggil untuk:", userAddress);

  document.getElementById("walletStatus").innerText = `Connected: ${shortenAddress(userAddress)}`;
  const btn = document.getElementById("btnConnect");
  btn.innerText = "Connected";
  btn.disabled = true;

  ["stakingBtn", "faucetBtn", "lpBtn", "btnSwap", "btnAddLiquidity"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
}





function handleAccountsChanged(accounts) {
  if (accounts.length === 0) resetUI(); else {
    userAddress = accounts[0];
    updateWalletUI();
    updateAllBalances();
  }
}

function updateWalletUI() {
  document.getElementById("walletStatus").innerText = `Connected: ${shortenAddress(userAddress)}`;
  const btn = document.getElementById("btnConnect");
  btn.innerText = "Connected";
  btn.disabled = true;

  // Tombol lain TIDAK di-disable atau enabled, supaya selalu aktif
}

function resetUI() {
  userAddress = null;
  document.getElementById("walletStatus").innerText = "Not connected";
  const btn = document.getElementById("btnConnect");
  btn.innerText = "Connect Wallet";
  btn.disabled = false;

  // Tombol lain TIDAK di-disable, supaya selalu aktif
}

function shortenAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

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
  list.innerHTML = "";
  tokenList.forEach(tok => {
    const div = document.createElement("div");
    div.className = "token-item";
    div.dataset.address = tok.address;
    div.dataset.symbol = tok.symbol;
    div.innerHTML = `<div class='token-balance' id='bal-${tok.symbol}'>⏳</div><div class='token-symbol'>${tok.symbol}</div>`;
    div.onclick = () => selectToken(tok);
    list.appendChild(div);
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
  const map = {
    swapIn: { btn: "tokenInBtn", bal: "tokenInBalance" },
    swapOut: { btn: "tokenOutBtn", bal: "tokenOutBalance" },
    liqIn: { btn: "liquidityTokenInBtn", bal: "liquidityTokenInBalance" },
    liqOut: { btn: "liquidityTokenOutBtn", bal: "liquidityTokenOutBalance" }
  };
  const ids = map[activeSelectionType];
  getBalance(tok).then(bal => {
    document.getElementById(ids.btn).innerHTML = `<div class='token-balance-display'>Balance: ${bal}</div><div class='token-symbol'>${tok.symbol}</div>`;
    document.getElementById(ids.bal).innerText = `Balance: ${bal}`;
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

async function updateSwapPreview() {
  const inEl = document.getElementById("amount"), outEl = document.getElementById("amountOut");
  if (!selectedSwapIn || !selectedSwapOut) return;
  const val = inEl.value; if (!val || isNaN(val)) return outEl.value = "";
  const wei = ethers.parseUnits(val, selectedSwapIn.decimals);
  try {
    const amts = await routerContract.getAmountsOut(wei, [selectedSwapIn.address, selectedSwapOut.address]);
    outEl.value = ethers.formatUnits(amts[1], selectedSwapOut.decimals);
  } catch (e) { outEl.value = ""; console.error(e); }
}

async function doSwap() {
  try {
    if (!selectedSwapIn || !selectedSwapOut) return alert("Pilih token swap in/out");
    const val = document.getElementById("amount").value;
    if (!val || isNaN(val)) return alert("Isi jumlah yang valid");
    const wei = ethers.parseUnits(val, selectedSwapIn.decimals);
    if (parseFloat(val) > parseFloat(await getBalance(selectedSwapIn))) return alert("Jumlah melebihi saldo");
    if (selectedSwapIn.address !== "native") {
      await new ethers.Contract(selectedSwapIn.address, ["function approve(address,uint256) returns(bool)"], signer).approve(routerAddress, wei);
    }
    const tx = await routerContract.swapExactTokensForTokens(wei, 0, [selectedSwapIn.address, selectedSwapOut.address], userAddress, Math.floor(Date.now()/1000)+600);
    await tx.wait(); alert("Swap sukses"); updateAllBalances();
  } catch (e) { console.error(e); alert("Swap gagal: " + e.message); }
}

// === Add Liquidity ===


// === Add Liquidity (Revisi pakai router) ===
async function addLiquidity() {
  const tokenA = document.getElementById("tokenIn").value;
  const tokenB = document.getElementById("tokenOut").value;
  if (!tokenA || !tokenB || tokenA === tokenB) return alert("⚠️ Pilih dua token berbeda.");

  const amountADesired = prompt(`Jumlah token A (${getSymbol(tokenA)}):`);
  const amountBDesired = prompt(`Jumlah token B (${getSymbol(tokenB)}):`);
  if (!amountADesired || !amountBDesired || isNaN(amountADesired) || isNaN(amountBDesired))
    return alert("⚠️ Jumlah tidak valid.");

  try {
    const router = new ethers.Contract(routerAddress, [
      "function addLiquidity(address,address,uint,uint,uint,uint,address,uint) returns (uint amountA, uint amountB, uint liquidity)",
      "function addLiquidityETH(address,uint,uint,uint,address,uint) payable returns (uint amountToken, uint amountETH, uint liquidity)"
    ], signer);

    const [decA, decB] = await Promise.all([
      new ethers.Contract(tokenA, ["function decimals() view returns (uint8)"], provider).decimals(),
      new ethers.Contract(tokenB, ["function decimals() view returns (uint8)"], provider).decimals()
    ]);

    const amtA = ethers.parseUnits(amountADesired, decA);
    const amtB = ethers.parseUnits(amountBDesired, decB);

    const tokenAbi = ["function approve(address,uint256) returns (bool)"];
    const approveA = new ethers.Contract(tokenA, tokenAbi, signer);
    const approveB = new ethers.Contract(tokenB, tokenAbi, signer);
    await (await approveA.approve(routerAddress, amtA)).wait();
    await (await approveB.approve(routerAddress, amtB)).wait();

    const deadline = Math.floor(Date.now() / 1000) + 600; // 10 menit
    const slippage = getSlippage();
    const minA = amtA * BigInt(100 - slippage) / 100n;
    const minB = amtB * BigInt(100 - slippage) / 100n;

    const tx = await router.addLiquidity(
      tokenA, tokenB,
      amtA, amtB,
      minA, minB,
      await signer.getAddress(),
      deadline
    );
    await tx.wait();
    alert("✅ Berhasil tambah liquidity.");
  } catch (e) {
    console.error(e);
    alert("❌ Gagal tambah liquidity: " + e.message);
  }
}



// === Balance Refresh ===
async function updateAllBalances() {
  for (const tok of tokenList) {
    const bal = await getBalance(tok);
    document.getElementById(`bal-${tok.symbol}`).innerText = `Balance: ${bal}`;
  }
}

// === Tab Switch ===
function switchPage(btn) {
  document.querySelectorAll(".tab-bar button").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(btn.dataset.target).classList.add("active");
}
