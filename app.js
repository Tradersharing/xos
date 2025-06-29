// ✅ app.js FINAL Terhubung Uniswap V3 (exactInputSingle), Dropdown aktif, RPC XOS auto, saldo native terbaca, validasi network, transaksi OKX/MetaMask aktif

let provider, signer;

const tokenList = [
  { address: ethers.ZeroAddress, symbol: "XOS", isNative: true },
  { address: "0x4a28dF32C0Ab6C9F1aEC67c1A7d5a7b0f25Eba10" },
  { address: "0x6d2aF57aAA70a10a145C5E5569f6E2f087D94e02" }
];

const routerAddress = "0xdc7D6b58c89A554b3FDC4B5B10De9b4DbF39FB40";
const explorerTxUrl = "https://testnet.xoscan.io/tx/";
const XOS_CHAIN_ID = "0x4F3"; // 1267

const routerAbi = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256)"
];

async function ensureXOSNetwork() {
  const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (currentChainId !== XOS_CHAIN_ID) {
    alert("🌐 Jaringan salah, ubah ke XOS Testnet");
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: XOS_CHAIN_ID }]
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: XOS_CHAIN_ID,
            chainName: 'XOS Testnet',
            nativeCurrency: { name: 'XOS', symbol: 'XOS', decimals: 18 },
            rpcUrls: ['https://rpc.xos.blockjoe.dev'],
            blockExplorerUrls: ['https://testnet.xoscan.io']
          }]
        });
      } else {
        throw switchError;
      }
    }
  }
}

async function connectWallet() {
  await ensureXOSNetwork();
  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  const address = await signer.getAddress();

  document.getElementById("walletStatus").innerText = "Connected: " + formatAddress(address);
  document.getElementById("btnSwap").disabled = false;
  document.getElementById("btnConnect").innerText = "Connected";
  document.getElementById("btnConnect").disabled = true;

  await populateTokenDropdowns();
  const native = await provider.getBalance(address);
  const xos = ethers.formatEther(native);
  document.getElementById("walletStatus").innerText += ` | ${parseFloat(xos).toFixed(3)} XOS`;
}

function formatAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

async function populateTokenDropdowns() {
  const abi = [
    "function balanceOf(address) view returns (uint)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ];
  const addr = signer ? await signer.getAddress() : null;
  const tokenIn = document.getElementById("tokenIn");
  const tokenOut = document.getElementById("tokenOut");
  tokenIn.innerHTML = "";
  tokenOut.innerHTML = "";

  for (const t of tokenList) {
    let label = t.symbol || "";
    if (t.isNative) {
      const bal = await provider.getBalance(addr);
      label = `XOS (${parseFloat(ethers.formatEther(bal)).toFixed(3)})`;
    } else {
      const c = new ethers.Contract(t.address, abi, signer);
      const raw = await c.balanceOf(addr);
      const dec = await c.decimals();
      const sym = await c.symbol();
      label = `${sym} (${parseFloat(ethers.formatUnits(raw, dec)).toFixed(2)})`;
    }
    tokenIn.appendChild(new Option(label, t.address));
    tokenOut.appendChild(new Option(label, t.address));
  }

  tokenIn.disabled = false;
  tokenOut.disabled = false;
}

async function doSwap() {
  try {
    const tokenIn = document.getElementById("tokenIn").value;
    const tokenOut = document.getElementById("tokenOut").value;
    const amount = document.getElementById("amount").value;
    const amountIn = ethers.parseUnits(amount, 18);
    if (!tokenIn || !tokenOut || !amount) return alert("Isi semua kolom");

    if (tokenIn !== ethers.ZeroAddress) {
      const abi = ["function approve(address,uint) returns (bool)"];
      const t = new ethers.Contract(tokenIn, abi, signer);
      const tx = await t.approve(routerAddress, amountIn);
      await tx.wait();
    }

    const router = new ethers.Contract(routerAddress, routerAbi, signer);
    const recipient = await signer.getAddress();
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
    console.error(err);
    document.getElementById("result").innerText = "❌ Swap gagal: " + (err.reason || err.message);
  }
}

window.addEventListener("load", async () => {
  if (window.ethereum) {
    provider = new ethers.BrowserProvider(window.ethereum);
    const accs = await provider.send("eth_accounts", []);
    if (accs.length > 0) await connectWallet();
    else await populateTokenDropdowns();
  }
});
