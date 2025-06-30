// ==== GLOBAL STATE ====
let provider, signer, currentTargetSelect = "";

const CHAIN_ID_DEC = 1267;
const CHAIN_ID_HEX = "0x4f3";
const XOS_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: "XOS Testnet",
  nativeCurrency: {
    name: "XOS",
    symbol: "XOS",
    decimals: 18
  },
  rpcUrls: ["https://testnet-rpc.xoscan.io/"],
  blockExplorerUrls: ["https://testnet.xoscan.io"]
};

const routerAddress = "0xdc7D6b58c89A554b3FDC4B5B10De9b4DbF39FB40";
const explorerTxUrl = "https://testnet.xoscan.io/tx/";

const tokenList = [
  { address: ethers.ZeroAddress, symbol: "XOS", isNative: true },
  { address: "0x4a28dF32C0Ab6C9F1aEC67c1A7d5a7b0f25Eba10", symbol: "USDT" }
];

// ==== CONNECT WALLET ====
async function connectWallet() {
  try {
    if (!window.ethereum) return alert("Please install MetaMask / OKX Wallet");

    await window.ethereum.request({ method: 'eth_requestAccounts' });
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    await ensureXOSNetwork();

    const address = await signer.getAddress();
    const balance = await provider.getBalance(address);
    const xosValue = ethers.formatEther(balance);

    document.getElementById("walletStatus").innerText = `Connected: ${shortenAddress(address)} | ${parseFloat(xosValue).toFixed(4)} XOS`;
    document.getElementById("btnConnect").innerText = "Connected";
    document.getElementById("btnSwap").disabled = false;
    populateTokenDropdowns();
  } catch (err) {
    console.error(err);
    alert("Failed to connect wallet");
  }
}

function shortenAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

async function ensureXOSNetwork() {
  const current = await window.ethereum.request({ method: 'eth_chainId' });
  if (current !== CHAIN_ID_HEX) {
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
    } catch (e) {
      if (e.code === 4902) {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [XOS_PARAMS] });
      } else {
        throw e;
      }
    }
  }
}

// ==== TOKEN DROPDOWNS ====
function populateTokenDropdowns() {
  ["tokenIn", "tokenOut"].forEach(id => {
    const el = document.getElementById(id);
    el.innerHTML = "";
    tokenList.forEach(t => el.appendChild(new Option(t.symbol, t.address)));
  });
}

function openTokenSelector(target) {
  currentTargetSelect = target;
  document.getElementById("tokenSelector").classList.remove("hidden");
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
    if (t.symbol.toLowerCase().includes(search)) {
      const el = document.createElement("button");
      el.textContent = t.symbol;
      el.onclick = () => selectToken(t.address, t.symbol);
      list.appendChild(el);
    }
  });
}

document.getElementById("searchToken").addEventListener("input", renderTokenList);

async function selectToken(address, symbol) {
  const select = document.getElementById(currentTargetSelect);
  let opt = [...select.options].find(o => o.value === address);
  if (!opt) {
    opt = new Option(symbol, address);
    select.appendChild(opt);
  }
  select.value = address;

  const btn = document.getElementById(currentTargetSelect + "Btn");
  if (btn) btn.innerText = symbol;

  const balance = await getTokenBalance(address);
  const balLabel = document.getElementById(currentTargetSelect + "Balance");
  if (balLabel) balLabel.innerText = `Balance: ${balance}`;

  closeTokenSelector();

  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;
  document.getElementById("btnSwap").disabled = (tokenIn === tokenOut || !tokenIn || !tokenOut);
}

async function getTokenBalance(tokenAddress) {
  try {
    if (!signer) return "0.00";
    const address = await signer.getAddress();
    if (tokenAddress === ethers.ZeroAddress) {
      const bal = await provider.getBalance(address);
      return parseFloat(ethers.formatEther(bal)).toFixed(4);
    } else {
      const abi = ["function balanceOf(address) view returns (uint)", "function decimals() view returns (uint8)"];
      const token = new ethers.Contract(tokenAddress, abi, provider);
      const [raw, dec] = await Promise.all([
        token.balanceOf(address),
        token.decimals()
      ]);
      return parseFloat(ethers.formatUnits(raw, dec)).toFixed(4);
    }
  } catch (e) {
    console.error(e);
    return "0.00";
  }
}

// ==== SWAP ====
async function doSwap() {
  const amount = document.getElementById("amount").value;
  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;
  if (!signer || !amount || tokenIn === tokenOut) return alert("Invalid swap");

  try {
    const decimals = 18;
    const amountIn = ethers.parseUnits(amount, decimals);
    const recipient = await signer.getAddress();
    const abi = [
      "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256)"
    ];
    const router = new ethers.Contract(routerAddress, abi, signer);

    if (tokenIn !== ethers.ZeroAddress) {
      const erc20 = new ethers.Contract(tokenIn, ["function approve(address, uint) returns (bool)"], signer);
      const tx = await erc20.approve(routerAddress, amountIn);
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
    document.getElementById("result").innerHTML = `✅ Swap success: <a href='${explorerTxUrl}${receipt.hash}' target='_blank'>${receipt.hash}</a>`;
  } catch (e) {
    console.error(e);
    document.getElementById("result").innerText = "❌ Swap failed: " + (e.reason || e.message);
  }
}

// ==== TAB ====
function switchPage(id, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".tab-bar button").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
}

window.addEventListener("load", () => {
  populateTokenDropdowns();
});
