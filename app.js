// === Wallet Connection ===
let provider;
let signer;

async function connectWallet() {
  if (window.ethereum) {
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    const address = await signer.getAddress();
    document.getElementById("walletStatus").innerText = "Connected: " + address.slice(0, 6) + "..." + address.slice(-4);

    document.getElementById("btnSwap").disabled = false;
    document.getElementById("tokenIn").disabled = false;
    document.getElementById("tokenOut").disabled = false;
  } else {
    alert("Please install MetaMask!");
  }
}

// === Dummy Token List ===
const tokenList = [
  { address: ethers.ZeroAddress, symbol: "BNB", isNative: true },
  { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT" },
  { address: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", symbol: "CAKE" },
  { address: "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", symbol: "BTCB" }
];

// === Swap Function (Dummy) ===
function doSwap() {
  const amount = document.getElementById("amount").value;
  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;

  document.getElementById("result").innerText = `Swapped ${amount} from ${tokenIn} to ${tokenOut}`;
}

// === Add Custom Token ===
function addCustomToken() {
  const address = document.getElementById("customTokenAddress").value;
  if (!address) return;

  tokenList.push({ address, symbol: "CUSTOM" });
  document.getElementById("customTokenAddress").value = "";
  alert("Token added to list.");
}

// === Page Navigation ===
function switchPage(pageId, btn) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");

  document.querySelectorAll(".tab-bar button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

// === Token Selector Popup Logic ===
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
          <div class="symbol">${address.slice(0, 6)}...${address.slice(-4)}</div>
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
