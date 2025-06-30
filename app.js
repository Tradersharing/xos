// ✅ app.js FINAL XOS Terintegrasi — support swap native/erc20, dropdown aktif, popup pencarian token, auto detect network

let provider, signer;

const CHAIN_ID_DEC = 1629;
const CHAIN_ID_HEX = "0x65D";

const XOS_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: "XOS Testnet",
  nativeCurrency: {
    name: "XOS",
    symbol: "XOS",
    decimals: 18
  },
  rpcUrls: ["https://xosrpc.com"],
  blockExplorerUrls: ["https://testnet.xoscan.io"]
};

const routerAddress = "0xdc7D6b58c89A554b3FDC4B5B10De9b4DbF39FB40";
const explorerTxUrl = "https://testnet.xoscan.io/tx/";

const tokenList = [
  { address: ethers.ZeroAddress, symbol: "XOS", isNative: true },
  { address: "0x4a28dF32C0Ab6C9F1aEC67c1A7d5a7b0f25Eba10", symbol: "USDT" }
];

const routerAbi = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256)"
];

async function ensureXOSNetwork() {
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (chainId !== CHAIN_ID_HEX) {
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [XOS_PARAMS] });
      } else {
        alert("Gagal switch jaringan");
        throw switchError;
      }
    }
  }
}

async function connectWallet() {
  if (!window.ethereum) return alert("Install MetaMask dulu gan!");
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    await ensureXOSNetwork();

    const address = await signer.getAddress();
    const balance = await provider.getBalance(address);
    const xosBalance = ethers.formatEther(balance);

    document.getElementById("walletStatus").innerText = `Connected: ${address.slice(0,6)}...${address.slice(-4)} | ${parseFloat(xosBalance).toFixed(4)} XOS`;
    document.getElementById("btnSwap").disabled = false;
    document.getElementById("btnConnect").innerText = "Connected";
    document.getElementById("btnConnect").disabled = true;

    populateTokenDropdowns();
  } catch (err) {
    console.error(err);
    alert("Gagal connect wallet");
  }
}

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

async function doSwap() {
  const amount = document.getElementById("amount").value;
  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;
  if (!signer || !amount || tokenIn === tokenOut) return alert("Input tidak valid!");

  try {
    const decimals = 18;
    const amountIn = ethers.parseUnits(amount, decimals);
    const recipient = await signer.getAddress();
    const router = new ethers.Contract(routerAddress, routerAbi, signer);

    if (tokenIn !== ethers.ZeroAddress) {
      const erc20Abi = ["function approve(address spender, uint amount) public returns (bool)"];
      const tokenContract = new ethers.Contract(tokenIn, erc20Abi, signer);
      const tx = await tokenContract.approve(routerAddress, amountIn);
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
    document.getElementById("result").innerHTML = `✅ Swap sukses: <a href="${explorerTxUrl}${receipt.hash}" target="_blank">${receipt.hash}</a>`;
  } catch (err) {
    console.error("Swap gagal:", err);
    document.getElementById("result").innerText = "❌ Swap gagal: " + (err.reason || err.message);
  }
}

// === TOKEN SELECTOR ===
let currentTargetSelect = null;

function openTokenSelector(targetId) {
  currentTargetSelect = targetId;
  document.getElementById("tokenSelector").classList.remove("hidden");
  document.getElementById("searchToken").value = "";
  renderTokenList();

  // sembunyikan network selain XOS
  document.querySelectorAll(".network").forEach(n => {
    n.style.display = n.textContent.trim() === "XOS" ? "inline-block" : "none";
  });
  // sembunyikan tombol populer selain XOS & USDT
  document.querySelectorAll(".popular-tokens button").forEach(btn => {
    const label = btn.textContent.trim();
    if (label !== "XOS" && label !== "USDT") btn.style.display = "none";
  });
}

function closeTokenSelector() {
  document.getElementById("tokenSelector").classList.add("hidden");
}

function renderTokenList() {
  const search = document.getElementById("searchToken").value.toLowerCase();
  const listEl = document.getElementById("tokenList");
  listEl.innerHTML = "";

  tokenList.forEach(t => {
    const address = t.address;
    const symbol = t.symbol;
    if (!symbol.toLowerCase().includes(search) && !address.toLowerCase().includes(search)) return;

    const el = document.createElement("div");
    el.className = "token-item";
    el.onclick = () => selectToken(address, symbol);
    el.innerHTML = `<div class="name">${symbol}</div><div class="symbol">${address.slice(0,6)}...${address.slice(-4)}</div>`;
    listEl.appendChild(el);
  });
}

document.getElementById("searchToken").addEventListener("input", renderTokenList);

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
    const opt = new Option(symbol, address);
    select.appendChild(opt);
    select.selectedIndex = select.options.length - 1;
  }
  closeTokenSelector();
}

function switchPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.tab-bar button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

window.addEventListener("load", () => {
  populateTokenDropdowns();
});
