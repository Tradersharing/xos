// ==== GLOBAL STATE ====
let provider, signer, currentTargetSelect = "";

// ==== NETWORK CONFIG ====
const CHAIN_ID_DEC = 1267;
const CHAIN_ID_HEX = "0x4f3"; // 1267 decimal
const XOS_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: "XOS Testnet",
  nativeCurrency: { name: "XOS", symbol: "XOS", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.xoscan.io/"],
  blockExplorerUrls: ["https://testnet.xoscan.io"]
};

// ==== ROUTER & TOKENS ====
const routerAddress = "0xdc7D6b58c89A554b3FDC4B5B10De9b4DbF39FB40";
const explorerTxUrl = "https://testnet.xoscan.io/tx/";
const routerAbi = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256)"
];
const tokenList = [
  { address: ethers.ZeroAddress, symbol: "XOS", isNative: true },
  { address: "0x4a28dF32C0Ab6C9F1aEC67c1A7d5a7b0f25Eba10", symbol: "USDT" }
];

// ==== ENSURE NETWORK ====
async function ensureXOSNetwork() {
  const current = await window.ethereum.request({ method: 'eth_chainId' });
  if (current.toLowerCase() !== CHAIN_ID_HEX) {
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [XOS_PARAMS] });
      } else {
        throw err;
      }
    }
  }
}

// ==== CONNECT WALLET ====
async function connectWallet() {
  try {
    if (!window.ethereum) return alert("Please install MetaMask / OKX Wallet");
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    await ensureXOSNetwork();

    const address = await signer.getAddress();
    const rawBalance = await provider.getBalance(address);
    const balance = parseFloat(ethers.formatEther(rawBalance)).toFixed(4);

    document.getElementById("walletStatus").innerText = `Connected: ${shortenAddress(address)} | ${balance} XOS`;
    document.getElementById("btnConnect").innerText = "Connected";
    document.getElementById("btnConnect").disabled = true;
    renderTokenList();
  } catch (e) {
    console.error(e);
    alert("Failed to connect wallet");
  }
}

function shortenAddress(addr) {
  return addr.slice(0,6) + "..." + addr.slice(-4);
}

// ==== TOKEN SELECTOR ====
function openTokenSelector(target) {
  currentTargetSelect = target;
  document.getElementById("tokenSelector").classList.remove("hidden");
}

function closeTokenSelector() {
  document.getElementById("tokenSelector").classList.add("hidden");
}

// ==== RENDER TOKEN LIST ====
function renderTokenList() {
  const search = document.getElementById("searchToken").value.toLowerCase();
  const listEl = document.getElementById("tokenList");
  listEl.innerHTML = "";
  tokenList.forEach(t => {
    if (!t.symbol.toLowerCase().includes(search)) return;
    const btn = document.createElement("button");
    btn.className = "token-list-item";
    btn.innerText = t.symbol;
    btn.onclick = () => selectToken(t.address, t.symbol);
    listEl.appendChild(btn);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderTokenList();
  document.getElementById("searchToken").addEventListener("input", renderTokenList);
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', connectWallet);
    window.ethereum.on('chainChanged', () => window.location.reload());
  }
});

// ==== SELECT TOKEN ====
async function selectToken(address, symbol) {
  const btn = document.getElementById(currentTargetSelect + "Btn");
  if (!btn) return;
  btn.innerText = symbol;
  btn.dataset.address = address;

  const balance = await getTokenBalance(address);
  const balEl = document.getElementById(currentTargetSelect + "Balance");
  if (balEl) balEl.innerText = `Balance: ${balance}`;

  closeTokenSelector();
  validateSwap();
}

// ==== VALIDATE SWAP INPUT ====
function validateSwap() {
  const inAddr = document.getElementById("tokenInBtn").dataset.address;
  const outAddr = document.getElementById("tokenOutBtn").dataset.address;
  const swapBtn = document.getElementById("btnSwap");
  swapBtn.disabled = (!inAddr || !outAddr || inAddr === outAddr);
}

// ==== GET TOKEN BALANCE ====
async function getTokenBalance(tokenAddress) {
  if (!signer) return "0.00";
  try {
    if (tokenAddress === ethers.ZeroAddress) {
      const bal = await provider.getBalance(await signer.getAddress());
      return parseFloat(ethers.formatEther(bal)).toFixed(4);
    } else {
      const abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
      const token = new ethers.Contract(tokenAddress, abi, provider);
      const [raw, dec] = await Promise.all([
        token.balanceOf(await signer.getAddress()),
        token.decimals()
      ]);
      return parseFloat(ethers.formatUnits(raw, dec)).toFixed(4);
    }
  } catch (e) {
    console.error(e);
    return "0.00";
  }
}

// ==== DO SWAP ====
async function doSwap() {
  const tokenIn = document.getElementById("tokenInBtn").dataset.address;
  const tokenOut = document.getElementById("tokenOutBtn").dataset.address;
  const amount = document.getElementById("amount").value;
  if (!signer || !amount || tokenIn === tokenOut) return alert("Invalid input!");
  try {
    const amountIn = ethers.parseUnits(amount, 18);
    const recipient = await signer.getAddress();
    const router = new ethers.Contract(routerAddress, routerAbi, signer);
    if (tokenIn !== ethers.ZeroAddress) {
      const erc20 = ["function approve(address spender, uint256 amount) public returns (bool)"];
      const tc = new ethers.Contract(tokenIn, erc20, signer);
      const txA = await tc.approve(routerAddress, amountIn);
      await txA.wait();
    }
    const tx = await router.exactInputSingle({ tokenIn, tokenOut, fee:3000, recipient, amountIn, amountOutMinimum:0, sqrtPriceLimitX96:0 });
    const receipt = await tx.wait();
    document.getElementById("result").innerHTML = `✅ Swap sukses: <a href="${explorerTxUrl}${receipt.hash}" target="_blank">${receipt.hash}</a>`;
  } catch (e) {
    console.error(e);
    document.getElementById("result").innerText = `❌ Swap gagal: ${e.reason||e.message}`;
  }
}

// ==== SWITCH PAGE ====
function switchPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.tab-bar button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ==== AUTO INIT ====
window.addEventListener('load', () => {
  validateSwap();
});
