// === WALLET CONNECTION & NETWORK ===
let provider, signer;
const XOS_CHAIN_ID = "0x65D"; // 1629 decimal, replace with real XOS chain ID if different
const XOS_PARAMS = {
  chainId: XOS_CHAIN_ID,
  chainName: "XOS Testnet",
  nativeCurrency: {
    name: "XOS",
    symbol: "XOS",
    decimals: 18,
  },
  rpcUrls: ["https://xosrpc.com"], // ganti dengan RPC XOS asli
  blockExplorerUrls: ["https://xosscan.com"]
};

async function connectWallet() {
  if (!window.ethereum) return alert("Install MetaMask dulu gan!");
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    await checkNetwork();

    const address = await signer.getAddress();
    const balance = await provider.getBalance(address);
    const xosBalance = ethers.formatEther(balance);

    document.getElementById("walletStatus").innerText = `Connected: ${address.slice(0,6)}...${address.slice(-4)} | XOS: ${parseFloat(xosBalance).toFixed(4)}`;

    document.getElementById("btnSwap").disabled = false;
    document.getElementById("tokenIn").disabled = false;
    document.getElementById("tokenOut").disabled = false;
  } catch (err) {
    console.error(err);
    alert("Gagal connect wallet");
  }
}

async function checkNetwork() {
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (chainId !== XOS_CHAIN_ID) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: XOS_CHAIN_ID }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [XOS_PARAMS],
        });
      } else {
        throw switchError;
      }
    }
  }
}

// === TOKEN LIST ===
const tokenList = [
  { address: ethers.ZeroAddress, symbol: "XOS", isNative: true },
  { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT" },
  { address: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", symbol: "CAKE" },
  { address: "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", symbol: "BTCB" }
];

// === SWAP (SIMULASI / REAL) ===
async function doSwap() {
  const amount = document.getElementById("amount").value;
  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;

  if (!signer) return alert("Wallet belum connect!");
  if (tokenIn === tokenOut) return alert("Token tidak boleh sama!");

  // NOTE: Ganti dengan logika smart contract swap asli
  document.getElementById("result").innerText = `✅ Swapped ${amount} from ${tokenIn} to ${tokenOut}`;
}

// === ADD CUSTOM TOKEN ===
function addCustomToken() {
  const address = document.getElementById("customTokenAddress").value;
  if (!address) return;

  tokenList.push({ address, symbol: "CUSTOM" });
  document.getElementById("customTokenAddress").value = "";
  alert("Custom token ditambahkan.");
}

// === PAGE NAVIGATION ===
function switchPage(pageId, btn) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");

  document.querySelectorAll(".tab-bar button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

// === TOKEN SELECTOR ===
let currentTargetSelect = null;

function openTokenSelector(targetId) {
  currentTargetSelect = targetId;
  document.getElementById("tokenSelector").classList.remove("hidden");
  renderTokenList();
}

function closeTokenSelector() {
  document.getElementById("tokenSelector").classList.add("hidden");
}

function renderTokenList() {
  const listEl = document.getElementById("tokenList");
  const search = document.getElementById("searchToken").value.toLowerCase();
  listEl.innerHTML = "";

  tokenList.forEach(t => {
    const address = t.address;
    const symbol = t.symbol || "TOKEN";
    const isMatch = symbol.toLowerCase().includes(search) || address.toLowerCase().includes(search);
    if (!isMatch) return;

    const item = document.createElement("div");
    item.className = "token-item";
    item.onclick = () => selectToken(address, symbol);
    item.innerHTML = `
      <div class="info">
        <img src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/${address}/logo.png" onerror="this.src='https://via.placeholder.com/24'" />
        <div>
          <div class="name">${symbol}</div>
          <div class="symbol">${address.slice(0,6)}...${address.slice(-4)}</div>
        </div>
      </div>
    `;
    listEl.appendChild(item);
  });
}

function selectToken(address, symbol) {
  const select = document.getElementById(currentTargetSelect);
  let found = false;
  for (const opt of select.options) {
    if (opt.value === address) {
      select.selectedIndex = opt.index;
      found = true;
      break;
    }
  }
  if (!found) {
    const opt = document.createElement("option");
    opt.value = address;
    opt.text = symbol;
    select.appendChild(opt);
    select.selectedIndex = select.options.length - 1;
  }
  closeTokenSelector();
}

document.getElementById("searchToken").addEventListener("input", renderTokenList);
