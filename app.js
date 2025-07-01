// ==== GLOBAL STATE ====
let provider, signer, currentTargetSelect = "";

const CHAIN_ID_HEX = "0x4F3"; // ✅ 1267
const XOS_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: "XOS Testnet",
  nativeCurrency: {
    name: "XOS",
    symbol: "XOS",
    decimals: 18
  },
  rpcUrls: ["https://testnet-rpc.xoscan.io"],
  blockExplorerUrls: ["https://testnet.xoscan.io"]
};

const routerAddress = "0xdc7D6b58c89A554b3FDC4B5B10De9b4DbF39FB40";
const routerAbi = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) external payable returns (uint256)"
];
const tokenList = [
  { address: ethers.ZeroAddress, symbol: "XOS" },
  { address: "0x2CCDB83a043A32898496c1030880Eb2cB977CAbc", symbol: "USDT" },
  { address: "0x6D2Af57AaA70A10A145C5E5569F6E2F087D94E02", symbol: "USDC" },
  { address: "0xb129536147c0CA420490d6b68d5bb69D7Bc2c151", symbol: "Tswap" }
];


// ==== CONNECT WALLET ====
async function connectWallet() {
  try {
    if (!window.ethereum) return alert("Please install MetaMask / OKX Wallet");
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId !== CHAIN_ID_HEX) {
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

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    const address = await signer.getAddress();
    const xosBalance = await provider.getBalance(address);
    const xosValue = ethers.formatEther(xosBalance);

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

function populateTokenDropdowns() {
  const tokenIn = document.getElementById("tokenIn");
  const tokenOut = document.getElementById("tokenOut");
  if (!tokenIn || !tokenOut) return;
  tokenIn.innerHTML = "";
  tokenOut.innerHTML = "";
  tokenList.forEach(token => {
    tokenIn.appendChild(new Option(token.symbol, token.address));
    tokenOut.appendChild(new Option(token.symbol, token.address));
  });
}

// ==== OPEN/CLOSE POPUP SELECTOR ====
function openTokenSelector(target) {
  currentTargetSelect = target;
  document.getElementById("tokenSelector").classList.remove("hidden");
  renderTokenList(); // load saldo dalam popup
}

function closeTokenSelector() {
  document.getElementById("tokenSelector").classList.add("hidden");
}

// ==== RENDER LIST TOKEN DI POPUP DENGAN SALDO ====
async function renderTokenList() {
  const listEl = document.getElementById("tokenList");
  listEl.innerHTML = "";

  for (const token of tokenList) {
    const balance = await getTokenBalance(token.address);
    const el = document.createElement("button");
    el.className = "token-select-button";
    el.innerHTML = `<div style="display:flex;justify-content:space-between">
      <span>${token.symbol}</span>
      <span style="font-size:13px;color:#666;">${balance}</span>
    </div>`;
    el.onclick = () => selectToken(token.address, token.symbol);
    listEl.appendChild(el);
  }
}

// ==== SELECT TOKEN ====
async function selectToken(address, symbol) {
  const other = currentTargetSelect === "tokenIn" ? "tokenOut" : "tokenIn";
  const otherVal = document.getElementById(other).value;
  if (address === otherVal) {
    alert("⚠️ Token tidak boleh sama!");
    return;
  }

  const btn = document.getElementById(currentTargetSelect + "Btn");
  const balanceEl = document.getElementById(currentTargetSelect + "Balance");

  if (btn) btn.innerText = symbol;
  if (balanceEl) balanceEl.innerText = `Balance: ${await getTokenBalance(address)}`;

  const input = document.getElementById(currentTargetSelect);
  if (input) input.value = address;

  closeTokenSelector();

  const tIn = document.getElementById("tokenIn").value;
  const tOut = document.getElementById("tokenOut").value;
  document.getElementById("btnSwap").disabled = (tIn === tOut || !tIn || !tOut);
  updateRatePreview();
}

// ==== GET SALDO ====
async function getTokenBalance(tokenAddress) {
  if (!signer || !provider) return "0.00";
  try {
    const userAddress = await signer.getAddress();

    if (tokenAddress.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
      const balance = await provider.getBalance(userAddress);
      return parseFloat(ethers.formatEther(balance)).toFixed(4);
    }

    const abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
    const token = new ethers.Contract(tokenAddress, abi, provider);
    const [rawBal, decimals] = await Promise.all([
      token.balanceOf(userAddress),
      token.decimals()
    ]);
    return parseFloat(ethers.formatUnits(rawBal, decimals)).toFixed(4);
  } catch (e) {
    console.error("❌ Error reading balance:", e);
    return "0.00";
  }
}

// ==== DO SWAP ====
async function doSwap() {
  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;
  const amount = document.getElementById("amount").value;
  if (!amount || tokenIn === tokenOut) return alert("Invalid input or same token!");

  try {
    const recipient = await signer.getAddress();
    let decimals = 18;
    if (tokenIn.toLowerCase() !== ethers.ZeroAddress.toLowerCase()) {
      const token = new ethers.Contract(tokenIn, ["function decimals() view returns (uint8)"], provider);
      decimals = await token.decimals();
    }
    const amountIn = ethers.parseUnits(amount, decimals);

    if (tokenIn.toLowerCase() !== ethers.ZeroAddress.toLowerCase()) {
      const approveAbi = ["function approve(address spender, uint256 amount) public returns (bool)"];
      const tokenContract = new ethers.Contract(tokenIn, approveAbi, signer);
      const txApprove = await tokenContract.approve(routerAddress, amountIn);
      await txApprove.wait();
    }

    const router = new ethers.Contract(routerAddress, routerAbi, signer);
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
    document.getElementById("result").innerHTML = `✅ Swap Success! <a href="https://testnet.xoscan.io/tx/${receipt.hash}" target="_blank">View Tx</a>`;
  } catch (err) {
    console.error("❌ Swap failed:", err);
    document.getElementById("result").innerText = "❌ Swap Failed: " + (err.reason || err.message || "Unknown error");
  }
}

// ==== RATE PREVIEW ====
async function updateRatePreview() {
  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;
  const amount = document.getElementById("amount").value;
  if (!amount || tokenIn === tokenOut) {
    document.getElementById("ratePreview").innerText = "";
    return;
  }

  try {
    const router = new ethers.Contract(routerAddress, routerAbi, signer);
    const erc20Abi = ["function decimals() view returns (uint8)"];
    const [decIn, decOut] = await Promise.all([
      tokenIn === ethers.ZeroAddress ? 18 : new ethers.Contract(tokenIn, erc20Abi, provider).decimals(),
      tokenOut === ethers.ZeroAddress ? 18 : new ethers.Contract(tokenOut, erc20Abi, provider).decimals()
    ]);
    const amountIn = ethers.parseUnits(amount, decIn);

    const result = await router.callStatic.exactInputSingle({
      tokenIn,
      tokenOut,
      fee: 3000,
      recipient: await signer.getAddress(),
      amountIn,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0
    });

    const rate = parseFloat(ethers.formatUnits(result, decOut)) / parseFloat(amount);
    document.getElementById("ratePreview").innerText = `≈ 1 ${getSymbol(tokenIn)} ≈ ${rate.toFixed(4)} ${getSymbol(tokenOut)}`;
  } catch (err) {
    document.getElementById("ratePreview").innerText = "Rate unavailable";
  }
}

function getSymbol(address) {
  const token = tokenList.find(t => t.address === address);
  return token ? token.symbol : "TOKEN";
}

// ==== SWITCH PAGE ====
function switchPage(id, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".tab-bar button").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
}

// ==== INIT ====
window.addEventListener("load", () => {
  populateTokenDropdowns();
  document.getElementById("amount").addEventListener("input", updateRatePreview);
});
