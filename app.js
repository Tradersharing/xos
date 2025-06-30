// ==== GLOBAL STATE ====
let provider, signer, currentTargetSelect = "";

const CHAIN_ID_HEX = "0x4F3"; // ✅ 1267 (dari screenshot)
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
  { address: "0x4a28dF32C0Ab6C9F1aEC67c1A7d5a7b0f25Eba10", symbol: "USDT" },
  { address: "0x6d2aF57aAA70a10a145C5E5569f6E2f087D94e02", symbol: "USDC" }
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
  tokenIn.innerHTML = "";
  tokenOut.innerHTML = "";
  tokenList.forEach(token => {
    tokenIn.appendChild(new Option(token.symbol, token.address));
    tokenOut.appendChild(new Option(token.symbol, token.address));
  });
}

// ==== OPEN TOKEN SELECTOR ====
function openTokenSelector(target) {
  currentTargetSelect = target;
  document.getElementById("tokenSelector").classList.remove("hidden");
  renderTokenList();
}

function closeTokenSelector() {
  document.getElementById("tokenSelector").classList.add("hidden");
}

// ==== TOKEN LIST RENDER ====
function renderTokenList() {
  const listEl = document.getElementById("tokenList");
  listEl.innerHTML = "";
  tokenList.forEach(t => {
    const el = document.createElement("div");
    el.className = "token-item";
    el.innerHTML = `<div class='name'>${t.symbol}</div>`;
    el.onclick = () => selectToken(t.address, t.symbol);
    listEl.appendChild(el);
  });
}

// ==== SELECT TOKEN ====
async function selectToken(address, symbol) {
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

  const btn = document.getElementById(currentTargetSelect + "Btn");
  if (btn) btn.innerText = symbol;

  const balance = await getTokenBalance(address);
  const balanceEl = document.getElementById(currentTargetSelect + "Balance");
  if (balanceEl) balanceEl.innerText = `Balance: ${balance}`;

  closeTokenSelector();

  const tIn = document.getElementById("tokenIn").value;
  const tOut = document.getElementById("tokenOut").value;
  document.getElementById("btnSwap").disabled = (tIn === tOut || !tIn || !tOut);
  updateRatePreview();
}

// ==== GET TOKEN BALANCE ====
async function getTokenBalance(tokenAddress) {
  if (!signer) return "0.00";
  try {
    if (tokenAddress === ethers.ZeroAddress) {
      const balance = await provider.getBalance(await signer.getAddress());
      return parseFloat(ethers.formatEther(balance)).toFixed(4);
    } else {
      const abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
      const token = new ethers.Contract(tokenAddress, abi, provider);
      const [rawBal, dec] = await Promise.all([
        token.balanceOf(await signer.getAddress()),
        token.decimals()
      ]);
      return parseFloat(ethers.formatUnits(rawBal, dec)).toFixed(4);
    }
  } catch (e) {
    console.error("Error get balance", e);
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
    const router = new ethers.Contract(routerAddress, routerAbi, signer);
    const recipient = await signer.getAddress();

    const erc20Abi = ["function decimals() view returns (uint8)", "function approve(address spender, uint amount) public returns (bool)"];
    const tokenInContract = tokenIn === ethers.ZeroAddress ? null : new ethers.Contract(tokenIn, erc20Abi, signer);
    const tokenOutContract = tokenOut === ethers.ZeroAddress ? null : new ethers.Contract(tokenOut, erc20Abi, signer);

    const [decIn, decOut] = await Promise.all([
      tokenInContract ? tokenInContract.decimals() : 18,
      tokenOutContract ? tokenOutContract.decimals() : 18
    ]);

    const amountIn = ethers.parseUnits(amount, decIn);

    const params = {
      tokenIn,
      tokenOut,
      fee: 3000,
      recipient,
      amountIn,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0
    };

    const expectedOut = await router.callStatic.exactInputSingle(params);
    const minOut = expectedOut * 97n / 100n;

    if (tokenIn !== ethers.ZeroAddress) {
      const approveTx = await tokenInContract.approve(routerAddress, amountIn);
      await approveTx.wait();
    }

    const swapTx = await router.exactInputSingle({ ...params, amountOutMinimum: minOut });
    const receipt = await swapTx.wait();
    document.getElementById("result").innerHTML = `✅ Swap Success! <a href='https://testnet.xoscan.io/tx/${receipt.hash}' target='_blank'>View Tx</a>`;
    document.getElementById("amount").value = "";
    updateRatePreview();
  } catch (err) {
    console.error("Swap failed", err);
    document.getElementById("result").innerText = "❌ Swap Failed: " + (err.reason || err.message);
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
  document.getElementById("tokenIn").addEventListener("change", updateRatePreview);
  document.getElementById("tokenOut").addEventListener("change", updateRatePreview);
});
