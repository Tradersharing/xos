// ✅ app.js FINAL — Simbol token otomatis dari kontrak, support native XOS, dropdown selalu aktif, swap aktif pakai exactInputSingle

let provider, signer;

const tokenList = [
  { address: "native" },
  { address: "0x4a28dF32C0Ab6C9F1aEC67c1A7d5a7b0f25Eba10" },
  { address: "0x6d2aF57aAA70a10a145C5E5569f6E2f087D94e02" }
];

const routerAddress = "0xdc7D6b58c89A554b3FDC4B5B10De9b4DbF39FB40";
const explorerTxUrl = "https://testnet.xoscan.io/tx/";
const XOS_CHAIN_ID = "0x4F3";

const erc20Abi = [
  "function approve(address spender, uint amount) public returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address owner) view returns (uint)"
];

const routerAbi = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256)"
];

async function ensureXOSNetwork() {
  try {
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (currentChainId !== XOS_CHAIN_ID) {
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
          alert("Gagal switch ke jaringan XOS");
          throw switchError;
        }
      }
    }
  } catch (err) {
    console.error("Gagal deteksi jaringan:", err);
    alert("Tidak dapat mendeteksi jaringan. Pastikan MetaMask aktif.");
  }
}

async function connectWallet() {
  await ensureXOSNetwork();
  if (window.ethereum) {
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
  } else {
    alert("MetaMask tidak ditemukan");
  }
}

function formatAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

async function populateTokenDropdowns() {
  const tokenInSelect = document.getElementById("tokenIn");
  const tokenOutSelect = document.getElementById("tokenOut");
  tokenInSelect.innerHTML = "";
  tokenOutSelect.innerHTML = "";

  let address = signer ? await signer.getAddress() : null;

  for (const token of tokenList) {
    try {
      let label = "";
      if (token.address === "native") {
        label = "XOS";
        if (provider && address) {
          const raw = await provider.getBalance(address);
          const balance = ethers.formatEther(raw);
          label += ` (${parseFloat(balance).toFixed(3)})`;
        }
      } else {
        const contract = new ethers.Contract(token.address, erc20Abi, signer);
        const symbol = await contract.symbol();
        const raw = await contract.balanceOf(address);
        const decimals = await contract.decimals();
        const balance = ethers.formatUnits(raw, decimals);
        label = `${symbol} (${parseFloat(balance).toFixed(2)})`;
      }
      tokenInSelect.appendChild(new Option(label, token.address));
      tokenOutSelect.appendChild(new Option(label, token.address));
    } catch (err) {
      console.warn("Token gagal dibaca:", token.address, err);
    }
  }
  tokenInSelect.disabled = false;
  tokenOutSelect.disabled = false;
}

async function init() {
  document.getElementById("btnConnect").disabled = false;
  document.getElementById("tokenIn").disabled = false;
  document.getElementById("tokenOut").disabled = false;
  if (window.ethereum) {
    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_accounts", []);
    if (accounts.length > 0) {
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
    } else {
      await populateTokenDropdowns();
    }
  } else {
    await populateTokenDropdowns();
  }
}

window.addEventListener("load", init);

document.getElementById("btnSwap").addEventListener("click", doSwap);

async function doSwap() {
  try {
    const tokenIn = document.getElementById("tokenIn").value;
    const tokenOut = document.getElementById("tokenOut").value;
    const amount = document.getElementById("amount").value;
    if (!tokenIn || !tokenOut || !amount) return alert("Lengkapi input terlebih dahulu");

    const isNative = tokenIn === "native";
    const recipient = await signer.getAddress();
    const swapContract = new ethers.Contract(routerAddress, routerAbi, signer);
    const amountIn = ethers.parseUnits(amount, 18);

    if (!isNative) {
      const tokenContract = new ethers.Contract(tokenIn, erc20Abi, signer);
      const approveTx = await tokenContract.approve(routerAddress, amountIn);
      await approveTx.wait();
    }

    const tx = await swapContract.exactInputSingle({
      tokenIn: tokenIn === "native" ? ethers.ZeroAddress : tokenIn,
      tokenOut: tokenOut === "native" ? ethers.ZeroAddress : tokenOut,
      fee: 3000,
      recipient,
      amountIn,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0
    }, { value: isNative ? amountIn : 0 });

    const receipt = await tx.wait();
    document.getElementById("result").innerHTML = `✅ Swap sukses: <a href="${explorerTxUrl}${receipt.hash}" target="_blank">${receipt.hash}</a>`;
  } catch (err) {
    console.error("Swap gagal:", err);
    document.getElementById("result").innerText = "❌ Swap gagal: " + err.message;
  }
}
