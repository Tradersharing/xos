// app.js FINAL — Swap aktif, LP & Staking dummy, fix ENS error, tombol connect update + saldo di dropdown

let provider, signer;

const tokenList = [
  { address: "0x5a726aE0A72C542c438655bA18eE61F7B6dB4c72", symbol: "XOS" },
  { address: "0x4a28b76840E73A1c52D34cF71A01388dC8aD0c42", symbol: "USDT" },
  { address: "0x1234567890abcdef1234567890abcdef12345678", symbol: "USDC" } // dummy, ganti jika perlu
];

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

async function doSwap() {
  try {
    const tokenIn = document.getElementById("tokenIn").value;
    const tokenOut = document.getElementById("tokenOut").value;
    const amount = document.getElementById("amount").value;
    const routerAddress = "0xYourRouterAddressHere"; // Ganti dengan router XOS Testnet

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

    const decimals = 18;
    const amountInWei = ethers.parseUnits(amount, decimals);

    const tokenInContract = new ethers.Contract(tokenIn, erc20Abi, signer);
    const routerContract = new ethers.Contract(routerAddress, routerAbi, signer);

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
    document.getElementById("result").innerText = "Swap sukses, tx hash: " + receipt.hash;
  } catch (err) {
    console.error("Swap gagal:", err);
    document.getElementById("result").innerText = "Swap gagal: " + err.message;
  }
}

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
  }

  tokenInSelect.disabled = false;
  tokenOutSelect.disabled = false;
}

document.getElementById("tokenIn").addEventListener("change", populateTokenDropdowns);

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
  initLiquidity();
  initStaking();
});
