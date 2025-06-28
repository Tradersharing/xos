// ✅ app.js FINAL untuk Tradersharing Swap (dropdown selalu aktif, add token di dropdown seperti PancakeSwap)

let provider, signer;

const tokenList = [

  { address: "0x4a28dF32C0Ab6C9F1aEC67c1A7d5a7b0f25Eba10", symbol: "USDT" },
  { address: "0x6d2aF57aAA70a10a145C5E5569f6E2f087D94e02", symbol: "USDC" }
];

const routerAddress = "0x778dBa0703801c4212dB2715b3a7b9c6D42Cf703";
const explorerTxUrl = "https://testnet.xoscan.io/tx/";

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
const XOS_CHAIN_ID = "0x4F3"; // 1267 dalam hexadecimal

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
          // RPC belum ditambahkan, maka tambahkan
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: XOS_CHAIN_ID,
              chainName: 'XOS Testnet',
              nativeCurrency: {
                name: 'XOS',
                symbol: 'XOS',
                decimals: 18
              },
              rpcUrls: ['https://rpc.xos.blockjoe.dev'],
              blockExplorerUrls: ['https://testnet.xoscan.io']
            }]
          });
        } else {
          alert("❌ Gagal switch ke jaringan XOS Testnet. Coba manual lewat wallet.");
          throw switchError;
        }
      }
    }
  } catch (err) {
    console.error("Jaringan tidak bisa dicek:", err);
    alert("⚠️ Tidak dapat mendeteksi jaringan. Pastikan MetaMask aktif.");
  }
}


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

function formatAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

async function init() {
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
    } else {
      await populateTokenDropdowns(); // tetap isi dropdown meski belum connect
    }
  } else {
    await populateTokenDropdowns(); // isi dropdown jika tidak ada wallet
  }
}

window.addEventListener("load", init);

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

  const address = signer ? await signer.getAddress() : null;

  for (const token of tokenList) {
    try {
      let label = token.symbol;
      if (signer) {
        const contract = new ethers.Contract(token.address, erc20Abi, signer);
        const raw = await contract.balanceOf(address);
        const decimals = await contract.decimals();
        const balance = ethers.formatUnits(raw, decimals);
        label += ` (${parseFloat(balance).toFixed(2)})`;
      }

      const optionIn = new Option(label, token.address);
      const optionOut = new Option(label, token.address);
      tokenInSelect.appendChild(optionIn);
      tokenOutSelect.appendChild(optionOut);
    } catch (err) {
      console.warn("Gagal baca token", token.address, err);
    }
  }
  
  tokenInSelect.disabled = false;
  tokenOutSelect.disabled = false;
}

async function init() {
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
        
async function tryAddTokenToDropdown(address) {
  const erc20Abi = [
    "function balanceOf(address owner) view returns (uint)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ];

  try {
    const contract = new ethers.Contract(address, erc20Abi, signer);
    const symbol = await contract.symbol();
    const decimals = await contract.decimals();
    const raw = await contract.balanceOf(await signer.getAddress());
    const balance = ethers.formatUnits(raw, decimals);
    const label = `${symbol} (${parseFloat(balance).toFixed(2)})`;

    const tokenIn = document.getElementById("tokenIn");
    const tokenOut = document.getElementById("tokenOut");

    if ([...tokenIn.options].some(opt => opt.value === address)) return;

    tokenIn.appendChild(new Option(label, address));
    tokenOut.appendChild(new Option(label, address));
  } catch (err) {
    console.warn("Gagal baca token custom", address, err);
  }
}

document.getElementById("tokenIn").addEventListener("change", async (e) => {
  const val = e.target.value;
  if (ethers.isAddress(val)) await tryAddTokenToDropdown(val);
});

document.getElementById("tokenOut").addEventListener("change", async (e) => {
  const val = e.target.value;
  if (ethers.isAddress(val)) await tryAddTokenToDropdown(val);
});

async function doSwap() {
  try {
    const tokenIn = document.getElementById("tokenIn").value;
    const tokenOut = document.getElementById("tokenOut").value;
    const amount = document.getElementById("amount").value;

    if (!tokenIn || !tokenOut || !amount) {
      alert("Isi semua input swap.");
      return;
    }

    const erc20Abi = [
      "function approve(address spender, uint amount) public returns (bool)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
      "function balanceOf(address owner) view returns (uint)"
    ];

    const routerAbi = [
      "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
      "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
    ];

    const tokenInContract = new ethers.Contract(tokenIn, erc20Abi, signer);
    const routerContract = new ethers.Contract(routerAddress, routerAbi, signer);

    const decimals = await tokenInContract.decimals();
    const amountInWei = ethers.parseUnits(amount, decimals);

    const approveTx = await tokenInContract.approve(routerAddress, amountInWei);
    await approveTx.wait();

    const amounts = await routerContract.getAmountsOut(amountInWei, [tokenIn, tokenOut]);
    const amountOutMin = amounts[1] - amounts[1] / BigInt(10);

    const userAddress = await signer.getAddress();
    const tx = await routerContract.swapExactTokensForTokens(
      amountInWei,
      amountOutMin,
      [tokenIn, tokenOut],
      userAddress,
      Math.floor(Date.now() / 1000) + 300
    );

    const receipt = await tx.wait();
    const txUrl = explorerTxUrl + receipt.hash;
    document.getElementById("result").innerHTML = `✅ Swap sukses: <a href="${txUrl}" target="_blank">${receipt.hash}</a>`;
  } catch (err) {
    console.error("Swap gagal:", err);
    document.getElementById("result").innerText = "❌ Swap gagal: " + err.message;
  }
}

function switchPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.tab-bar button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (id === 'faucet') {
    document.querySelector('#faucet iframe').style.height = window.innerHeight - 100 + 'px';
  }
}

function initLiquidity() {
  const container = document.getElementById('liquidity');
  container.innerHTML = '<div class="page-inner"><h2>Liquidity - Coming Soon</h2><p>Tempat untuk add/remove liquidity akan tampil di sini.</p></div>';
}

function initStaking() {
  const container = document.getElementById('staking');
  container.innerHTML = '<div class="page-inner"><h2>Staking - Coming Soon</h2><p>Tempat staking dan klaim reward akan muncul di sini.</p></div>';
}

window.addEventListener("load", () => {
  init();
  initLiquidity();
  initStaking();
});
