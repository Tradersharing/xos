// === Global Variables ===
let provider, signer;
const CHAIN_ID_DEC = 1629;
const CHAIN_ID_HEX = "0x65d"; // lowercase untuk MetaMask compatibility

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
  { address: "0x4a28dF32C0Ab6C9F1aEC67c1A7d5a7b0f25Eba10", symbol: "USDT" },
  { address: "0x6d2aF57aAA70a10a145C5E5569f6E2f087D94e02", symbol: "USDC" }
];

const routerAbi = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256)"
];

// === Network Handling ===
async function ensureXOSNetwork() {
  const currentChain = await window.ethereum.request({ method: 'eth_chainId' });
  if (currentChain.toLowerCase() !== CHAIN_ID_HEX) {
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

// === Wallet Connect ===
async function connectWallet() {
  if (!window.ethereum) return alert("Install MetaMask dulu gan!");
  try {
    await ensureXOSNetwork();
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    const address = await signer.getAddress();
    const balance = await provider.getBalance(address);
    const xosBalance = ethers.formatEther(balance);

    document.getElementById("walletStatus").innerText = `Connected: ${address.slice(0, 6)}...${address.slice(-4)} | ${parseFloat(xosBalance).toFixed(4)} XOS`;
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

// === Token Select Popup ===
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
  const listEl = document.getElementById("tokenList");
  listEl.innerHTML = "";

  tokenList.forEach(({ address, symbol }) => {
    if (!symbol.toLowerCase().includes(search) && !address.toLowerCase().includes(search)) return;
    const el = document.createElement("button");
    el.onclick = () => selectToken(address, symbol);
    el.innerHTML = `${symbol} <small>${address.slice(0,6)}...${address.slice(-4)}</small>`;
    listEl.appendChild(el);
  });
}

document.getElementById("searchToken").addEventListener("input", renderTokenList);

function selectToken(address, symbol) {
  const btn = currentTargetSelect === "tokenIn" ? document.getElementById("tokenInBtn") : document.getElementById("tokenOutBtn");
  const selectEl = document.getElementById(currentTargetSelect);
  if (selectEl && btn) {
    let found = false;
    for (const opt of selectEl.options) {
      if (opt.value === address) {
        selectEl.selectedIndex = opt.index;
        found = true;
        break;
      }
    }
    if (!found) {
      const opt = new Option(symbol, address);
      selectEl.appendChild(opt);
      selectEl.selectedIndex = selectEl.options.length - 1;
    }
    btn.innerText = symbol;
  }
  closeTokenSelector();
}

// === Swap Execution ===
async function doSwap() {
  const amount = document.getElementById("amount").value;
  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;
  const resultBox = document.getElementById("result");

  if (!signer || !amount || tokenIn === tokenOut || !tokenIn || !tokenOut) return alert("Input tidak valid!");

  try {
    const amountIn = ethers.parseUnits(amount, 18);
    const recipient = await signer.getAddress();
    const router = new ethers.Contract(routerAddress, routerAbi, signer);

    if (tokenIn !== ethers.ZeroAddress) {
      const erc20Abi = ["function approve(address spender, uint amount) public returns (bool)"];
      const tokenContract = new ethers.Contract(tokenIn, erc20Abi, signer);
      const txApprove = await tokenContract.approve(routerAddress, amountIn);
      await txApprove.wait();
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
    resultBox.innerHTML = `✅ Swap sukses: <a href="${explorerTxUrl}${receipt.hash}" target="_blank">${receipt.hash}</a>`;
  } catch (err) {
    console.error("Swap gagal:", err);
    resultBox.innerText = "❌ Swap gagal: " + (err.reason || err.message);
  }
}

// === Page Switcher ===
function switchPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.tab-bar button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// === Initializer ===
window.addEventListener("load", () => {
  populateTokenDropdowns();
});
