// ✅ app.js FINAL — Terintegrasi HTML swap Tradersharing (XOS Testnet)
// Fitur: Connect wallet, dropdown token + saldo, approve + swap aktif, hash ke explorer

let provider, signer;

const tokenList = [
  { address: "0x5a726a26b4a1c3f8b8ce86a388aac3a4bdcb7281", symbol: "XOS" },
  { address: "0x4a28dF32C0Ab6C9F1aEC67c1A7d5a7b0f25Eba10", symbol: "USDT" },
  { address: "0x6d2aF57aAA70a10a145C5E5569f6E2f087D94e02", symbol: "USDC" }
];

const routerAddress = "0x778dBa0703801c4212dB2715b3a7b9c6D42Cf703"; // XOS Testnet Router
const explorerTxUrl = "https://testnet.xoscan.io/tx/";

async function connectWallet() {
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
  } else {
    alert("MetaMask tidak ditemukan");
  }
}

function formatAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

async function init() {
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
    }
  }
}

window.addEventListener("load", init);

async function populateTokenDropdowns() {
  const erc20Abi = [
    "function balanceOf(address owner) view returns (uint)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ];

  const address = await signer.getAddress();
  const tokenInSelect = document.getElementById("tokenIn");
  const tokenOutSelect = document.getElementById("tokenOut");

  tokenInSelect.innerHTML = "";
  tokenOutSelect.innerHTML = "";

  for (const token of tokenList) {
    try {
      const contract = new ethers.Contract(token.address, erc20Abi, signer);
      const raw = await contract.balanceOf(address);
      const decimals = await contract.decimals();
      const balance = ethers.formatUnits(raw, decimals);
      const label = `${token.symbol} (${parseFloat(balance).toFixed(2)})`;

      const optionIn = document.createElement("option");
      optionIn.value = token.address;
      optionIn.textContent = label;

      const optionOut = document.createElement("option");
      optionOut.value = token.address;
      optionOut.textContent = label;

      tokenInSelect.appendChild(optionIn);
      tokenOutSelect.appendChild(optionOut);
    } catch (err) {
      console.warn("Gagal ambil data token", token.symbol, err);
    }
  }

  tokenInSelect.disabled = false;
  tokenOutSelect.disabled = false;
}

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
