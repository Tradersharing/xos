// app.js lengkap untuk Swap aktif, Staking & LP dummy

let provider, signer;

async function connectWallet() {
  if (window.ethereum) {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    const address = await signer.getAddress();
    document.getElementById("walletStatus").innerText = "Connected: " + formatAddress(address);
    document.getElementById("btnSwap").disabled = false;
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
    }
  }
}

window.addEventListener("load", init);

async function doSwap() {
  try {
    const tokenIn = document.getElementById("tokenIn").value;
    const tokenOut = document.getElementById("tokenOut").value;
    const amount = document.getElementById("amount").value;
    const routerAddress = "0xYourRouterAddressHere"; // Ganti

    if (!tokenIn || !tokenOut || !amount) {
      alert("Isi semua input swap.");
      return;
    }

    const erc20Abi = [
      "function approve(address spender, uint amount) public returns (bool)",
      "function decimals() view returns (uint8)"
    ];

    const routerAbi = [
      "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
      "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
    ];

    const decimals = 18; // ubah sesuai token
    const amountInWei = ethers.parseUnits(amount, decimals);

    const tokenInContract = new ethers.Contract(tokenIn, erc20Abi, signer);
    const routerContract = new ethers.Contract(routerAddress, routerAbi, signer);

    // Approve
    const approveTx = await tokenInContract.approve(routerAddress, amountInWei);
    await approveTx.wait();

    const amounts = await routerContract.getAmountsOut(amountInWei, [tokenIn, tokenOut]);
    const amountOutMin = amounts[1] - amounts[1] / BigInt(10); // slippage 10%

    const tx = await routerContract.swapExactTokensForTokens(
      amountInWei,
      amountOutMin,
      [tokenIn, tokenOut],
      await signer.getAddress(),
      Math.floor(Date.now() / 1000) + 300
    );

    const receipt = await tx.wait();
    document.getElementById("result").innerText = "Swap sukses, tx hash: " + receipt.hash;
  } catch (err) {
    console.error("Swap gagal:", err);
    document.getElementById("result").innerText = "Swap gagal: " + err.message;
  }
}

function switchPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.tab-bar button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// Dummy init LP & Staking page (kotak kerja)
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
