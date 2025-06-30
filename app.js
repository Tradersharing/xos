// ==== GLOBAL ====
let provider, signer;
const CHAIN_ID_HEX = "0x65D"; // 1629
const XOS_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: "XOS Testnet",
  nativeCurrency: { name: "XOS", symbol: "XOS", decimals: 18 },
  rpcUrls: ["https://xosrpc.com"],
  blockExplorerUrls: ["https://testnet.xoscan.io"]
};
const routerAddress = "0xdc7D6b58c89A554b3FDC4B5B10De9b4DbF39FB40";
const explorerTxUrl = "https://testnet.xoscan.io/tx/";
const tokenList = [
  { address: ethers.ZeroAddress, symbol: "XOS", isNative: true },
  { address: "0x4a28dF32C0Ab6C9F1aEC67c1A7d5a7b0f25Eba10", symbol: "USDT" }
];

// ==== WALLET ====
async function connectWallet() {
  if (!window.ethereum) return alert("Please install MetaMask / OKX Wallet");
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    await ensureXOSNetwork();

    const addr = await signer.getAddress();
    const bal = await provider.getBalance(addr);
    const xosVal = ethers.formatEther(bal);

    document.getElementById("walletStatus").innerText = `Connected: ${shortenAddress(addr)} | ${parseFloat(xosVal).toFixed(4)} XOS`;
    document.getElementById("btnConnect").innerText = "Connected";
    document.getElementById("btnConnect").disabled = true;
    document.getElementById("btnSwap").disabled = true;

    populateTokenDropdowns();
  } catch (err) {
    console.error(err);
    alert("Failed to connect wallet");
  }
}

async function ensureXOSNetwork() {
  const current = await window.ethereum.request({ method: 'eth_chainId' });
  if (current !== CHAIN_ID_HEX) {
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [XOS_PARAMS] });
      } else throw err;
    }
  }
}

function shortenAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// ==== TOKENS ====
function populateTokenDropdowns() {
  const tokenIn = document.getElementById("tokenIn");
  const tokenOut = document.getElementById("tokenOut");
  tokenIn.innerHTML = "";
  tokenOut.innerHTML = "";
  tokenList.forEach(token => {
    const opt1 = new Option(token.symbol, token.address);
    const opt2 = new Option(token.symbol, token.address);
    tokenIn.appendChild(opt1);
    tokenOut.appendChild(opt2);
  });
}

// ==== POPUP TOKEN ====
let currentTargetSelect = null;

function openTokenSelector(targetId) {
  currentTargetSelect = targetId;
  document.getElementById("tokenSelector").classList.remove("hidden");
  document.getElementById("searchToken").value = "";
  renderTokenList();
}

function closeTokenSelector() {
  document.getElementById("tokenSelector").classList.add("hidden");
}

function renderTokenList() {
  const search = document.getElementById("searchToken").value.toLowerCase();
  const list = document.getElementById("tokenList");
  list.innerHTML = "";

  tokenList.forEach(t => {
    if (!t.symbol.toLowerCase().includes(search)) return;
    const div = document.createElement("div");
    div.className = "token-item";
    div.innerHTML = `<div>${t.symbol}</div>`;
    div.onclick = () => selectToken(t.address, t.symbol);
    list.appendChild(div);
  });
}

async function selectToken(address, symbol) {
  const select = document.getElementById(currentTargetSelect);
  const btn = document.getElementById(currentTargetSelect + "Btn");
  select.value = address;
  btn.innerText = symbol;

  const bal = await getTokenBalance(address);
  const balanceSpan = document.getElementById(currentTargetSelect + "Balance");
  if (balanceSpan) balanceSpan.innerText = `Balance: ${bal}`;

  closeTokenSelector();

  const valIn = document.getElementById("tokenIn").value;
  const valOut = document.getElementById("tokenOut").value;
  document.getElementById("btnSwap").disabled = (valIn === valOut || !valIn || !valOut);
}

async function getTokenBalance(address) {
  if (!signer) return "0.00";
  try {
    if (address === ethers.ZeroAddress) {
      const bal = await provider.getBalance(await signer.getAddress());
      return parseFloat(ethers.formatEther(bal)).toFixed(4);
    } else {
      const abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
      const token = new ethers.Contract(address, abi, provider);
      const [raw, dec] = await Promise.all([
        token.balanceOf(await signer.getAddress()),
        token.decimals()
      ]);
      return parseFloat(ethers.formatUnits(raw, dec)).toFixed(4);
    }
  } catch (e) {
    console.error("Balance error", e);
    return "0.00";
  }
}

// ==== SWAP ====
async function doSwap() {
  const amount = document.getElementById("amount").value;
  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;
  if (!signer || !amount || tokenIn === tokenOut) return alert("Invalid input");

  try {
    const amountIn = ethers.parseUnits(amount, 18);
    const recipient = await signer.getAddress();
    const router = new ethers.Contract(routerAddress, [
      "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) external payable returns (uint256)"
    ], signer);

    if (tokenIn !== ethers.ZeroAddress) {
      const token = new ethers.Contract(tokenIn, ["function approve(address spender,uint amount) returns (bool)"], signer);
      const tx = await token.approve(routerAddress, amountIn);
      await tx.wait();
    }

    const tx = await router.exactInputSingle({
      tokenIn,
      tokenOut,
      fee: 3000,
      recipient,
      amountIn,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0
    });

    const receipt = await tx.wait();
    document.getElementById("result").innerHTML = `✅ Swap success: <a href="${explorerTxUrl}${receipt.hash}" target="_blank">${receipt.hash}</a>`;
  } catch (err) {
    console.error("Swap error:", err);
    document.getElementById("result").innerText = "❌ Swap failed: " + (err.reason || err.message);
  }
}

// ==== TABS ====
function switchPage(id, btn) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".tab-bar button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

// ==== EVENTS ====
window.addEventListener("DOMContentLoaded", () => {
  populateTokenDropdowns();
  document.getElementById("searchToken").addEventListener("input", renderTokenList);

  if (window.ethereum) {
    window.ethereum.on("chainChanged", () => window.location.reload());
    window.ethereum.on("accountsChanged", () => window.location.reload());
  }
});
