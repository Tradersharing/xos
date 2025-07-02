// ==== TradersharingSwap DApp (Router: 0x89ff1b118ec9315295801c594983ee190b9a4598) ====

let provider, signer, currentTargetSelect = "";

const CHAIN_ID_HEX = "0x4F3";
const XOS_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: "XOS Testnet",
  nativeCurrency: { name: "XOS", symbol: "XOS", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.xoscan.io"],
  blockExplorerUrls: ["https://testnet.xoscan.io"]
};

const routerAddress = "0x89ff1b118ec9315295801c594983ee190b9a4598"; // ✅ Final Router
const routerAbi = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) external payable returns (uint256)"
];

const tokenList = [
  { address: ethers.ZeroAddress, symbol: "XOS" },
  { address: "0x2CCDB83a043A32898496c1030880Eb2cB977CAbc", symbol: "USDT" },
  { address: "0x6D2Af57AaA70A10A145C5E5569F6E2F087D94E02", symbol: "USDC" },
  { address: "0xb129536147c0CA420490d6b68d5bb69D7Bc2c151", symbol: "Tswap" }
];

function getSymbol(address) {
  const t = tokenList.find(x => x.address === address);
  return t ? t.symbol : "TOKEN";
}

function getSlippage() {
  const el = document.getElementById("slippage");
  const p = parseFloat(el?.value || "1");
  return isNaN(p) ? 1 : p;
}

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
        } else throw e;
      }
    }

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    const address = await signer.getAddress();
    const xosBalance = await provider.getBalance(address);

    document.getElementById("walletStatus").innerText = `Connected: ${shortenAddress(address)} | ${parseFloat(ethers.formatEther(xosBalance)).toFixed(4)} XOS`;
    document.getElementById("btnConnect").innerText = "Connected";
    document.getElementById("btnSwap").disabled = false;
    populateTokenDropdowns();
  } catch (err) {
    console.error(err);
    alert("Failed to connect wallet");
  }
}

function shortenAddress(a) {
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function openTokenSelector(target) {
  currentTargetSelect = target;
  document.getElementById("tokenSelector").classList.remove("hidden");
  renderTokenList();
}

function closeTokenSelector() {
  document.getElementById("tokenSelector").classList.add("hidden");
}

async function renderTokenList() {
  const el = document.getElementById("tokenList");
  el.innerHTML = "";
  for (const t of tokenList) {
    const html = `<div class="token-item" onclick="selectToken('${t.address}','${t.symbol}')">
      <div class="token-info">
        <img src="assets/icons/${t.symbol.toLowerCase()}.png" onerror="this.src='assets/icons/blank.png'">
        <div class="token-symbol">${t.symbol}</div>
      </div>
      <div class="token-balance" id="balance-${t.symbol}"></div>
    </div>`;
    el.insertAdjacentHTML("beforeend", html);
    getTokenBalance(t.address).then(bal => {
      document.getElementById(`balance-${t.symbol}`).innerText = `${bal}`;
    });
  }
}

async function selectToken(address, symbol) {
  const other = currentTargetSelect === "tokenIn" ? "tokenOut" : "tokenIn";
  const otherVal = document.getElementById(other).value;
  if (address === otherVal) return alert("⚠️ Token tidak boleh sama!");

  document.getElementById(currentTargetSelect + "Btn").innerHTML = `
    <img src="assets/icons/${symbol.toLowerCase()}.png" onerror="this.src='assets/icons/blank.png'">
    <span>${symbol}</span>`;

  const balanceEl = document.getElementById(currentTargetSelect + "Balance");
  balanceEl.innerHTML = "Balance: Loading...";
  getTokenBalance(address).then(b => {
    balanceEl.innerText = `Balance: ${b}`;
  });

  document.getElementById(currentTargetSelect).value = address;
  closeTokenSelector();
  const tIn = document.getElementById("tokenIn").value;
  const tOut = document.getElementById("tokenOut").value;
  document.getElementById("btnSwap").disabled = (tIn === tOut || !tIn || !tOut);
  updateRatePreview();
}

async function getTokenBalance(addr) {
  if (!signer || !provider) return "0.00";
  try {
    const user = await signer.getAddress();
    if (addr.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
      const bal = await provider.getBalance(user);
      return parseFloat(ethers.formatEther(bal)).toFixed(4);
    }
    const abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
    const token = new ethers.Contract(addr, abi, provider);
    const [raw, dec] = await Promise.all([token.balanceOf(user), token.decimals()]);
    return parseFloat(ethers.formatUnits(raw, dec)).toFixed(4);
  } catch {
    return "0.00";
  }
}

async function doSwap() {
  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;
  const amount = document.getElementById("amount").value;
  if (!amount || tokenIn === tokenOut) return alert("Invalid input!");

  try {
    const recipient = await signer.getAddress();
    const decimals = tokenIn === ethers.ZeroAddress ? 18 : await new ethers.Contract(tokenIn, ["function decimals() view returns (uint8)"], provider).decimals();
    const amountIn = ethers.parseUnits(amount, decimals);
    const amountOutMin = 0n; // sementara 0, bisa nanti dihitung

    if (tokenIn !== ethers.ZeroAddress) {
      const token = new ethers.Contract(tokenIn, ["function approve(address,uint256) returns (bool)"], signer);
      await (await token.approve(routerAddress, amountIn)).wait();
    }

    const router = new ethers.Contract(routerAddress, routerAbi, signer);
    const tx = await router.swapExactTokensForTokens(amountIn, amountOutMin, tokenIn, tokenOut, recipient);
    const receipt = await tx.wait();
    document.getElementById("result").innerHTML = `✅ Swap Success! <a href="https://testnet.xoscan.io/tx/${receipt.hash}" target="_blank">View Tx</a>`;
  } catch (e) {
    document.getElementById("result").innerText = "❌ Swap Failed: " + (e.reason || e.message || "Unknown error");
  }
}


async function updateRatePreview() {
  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;
  const amount = document.getElementById("amount").value;
  if (!amount || tokenIn === tokenOut) return document.getElementById("ratePreview").innerText = "";

  try {
    const router = new ethers.Contract(routerAddress, routerAbi, signer);
    const erc20Abi = ["function decimals() view returns (uint8)"];
    const [decIn, decOut] = await Promise.all([
      tokenIn === ethers.ZeroAddress ? 18 : new ethers.Contract(tokenIn, erc20Abi, provider).decimals(),
      tokenOut === ethers.ZeroAddress ? 18 : new ethers.Contract(tokenOut, erc20Abi, provider).decimals()
    ]);
    const amountIn = ethers.parseUnits(amount, decIn);
    const result = await router.callStatic.exactInputSingle({
      tokenIn, tokenOut, fee: 3000, recipient: await signer.getAddress(), amountIn, amountOutMinimum: 0, sqrtPriceLimitX96: 0
    });
    const rate = parseFloat(ethers.formatUnits(result, decOut)) / parseFloat(amount);
    document.getElementById("amountOut").value = parseFloat(ethers.formatUnits(result, decOut)).toFixed(4);
    document.getElementById("ratePreview").innerText = `≈ 1 ${getSymbol(tokenIn)} ≈ ${rate.toFixed(4)} ${getSymbol(tokenOut)}`;
  } catch {
    document.getElementById("ratePreview").innerText = "Rate unavailable";
  }
}

window.addEventListener("load", () => {
  populateTokenDropdowns();
  document.getElementById("amount").addEventListener("input", updateRatePreview);
});

function populateTokenDropdowns() {
  // handled by popup selector
}
