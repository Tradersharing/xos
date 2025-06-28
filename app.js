// ✅ app.js FINAL — Simbol token otomatis dari kontrak, support native XOS, dropdown selalu aktif, anti-error saat load

let provider, signer;

const tokenList = [
  { address: "native" },
  { address: "0x4a28dF32C0Ab6C9F1aEC67c1A7d5a7b0f25Eba10" },
  { address: "0x6d2aF57aAA70a10a145C5E5569f6E2f087D94e02" }
];

const routerAddress = "0x778dBa0703801c4212dB2715b3a7b9c6D42Cf703";
const explorerTxUrl = "https://testnet.xoscan.io/tx/";
const XOS_CHAIN_ID = "0x4F3";

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
  const erc20Abi = [
    "function balanceOf(address owner) view returns (uint)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ];

  const tokenInSelect = document.getElementById("tokenIn");
  const tokenOutSelect = document.getElementById("tokenOut");

  tokenInSelect.innerHTML = "";
  tokenOutSelect.innerHTML = "";

  let address = null;
  try {
    address = signer ? await signer.getAddress() : null;
  } catch (e) {
    console.warn("Signer belum siap:", e);
  }

  try {
    for (const token of tokenList) {
      let label = "";
      if (token.address === "native") {
        label = "XOS";
        if (provider && address) {
          const raw = await provider.getBalance(address);
          const balance = ethers.formatEther(raw);
          label += ` (${parseFloat(balance).toFixed(3)})`;
        }
      } else if (signer && address) {
        const contract = new ethers.Contract(token.address, erc20Abi, signer);
        const symbol = await contract.symbol();
        const raw = await contract.balanceOf(address);
        const decimals = await contract.decimals();
        const balance = ethers.formatUnits(raw, decimals);
        label = `${symbol} (${parseFloat(balance).toFixed(2)})`;
      }
      tokenInSelect.appendChild(new Option(label, token.address));
      tokenOutSelect.appendChild(new Option(label, token.address));
    }
  } catch (err) {
    console.error("Dropdown populate error:", err);
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
