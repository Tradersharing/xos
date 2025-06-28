// ✅ app.js FINAL untuk Tradersharing Swap (support native XOS, ERC20 ↔ ERC20 & XOS ↔ ERC20)

let provider, signer;

const tokenList = [
  { address: "native", symbol: "XOS" },
  { address: "0x4a28dF32C0Ab6C9F1aEC67c1A7d5a7b0f25Eba10", symbol: "USDT" },
  { address: "0x6d2aF57aAA70a10a145C5E5569f6E2f087D94e02", symbol: "USDC" }
];

const routerAddress = "0x778dBa0703801c4212dB2715b3a7b9c6D42Cf703";
const explorerTxUrl = "https://testnet.xoscan.io/tx/";
const XOS_CHAIN_ID = "0x4F3";

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
      "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
      "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable external returns (uint[] memory amounts)",
      "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
    ];

    const router = new ethers.Contract(routerAddress, routerAbi, signer);
    const userAddress = await signer.getAddress();
    const path = [tokenIn, tokenOut];
    const deadline = Math.floor(Date.now() / 1000) + 300;

    let amountInWei;
    let amountOutMin;
    let tx;

    if (tokenIn === "native") {
      const amounts = await router.getAmountsOut(ethers.parseEther(amount), path);
      amountOutMin = amounts[1] - amounts[1] / BigInt(10);
      tx = await router.swapExactETHForTokens(
        amountOutMin,
        path,
        userAddress,
        deadline,
        { value: ethers.parseEther(amount) }
      );
    } else if (tokenOut === "native") {
      const tokenInContract = new ethers.Contract(tokenIn, erc20Abi, signer);
      const decimals = await tokenInContract.decimals();
      amountInWei = ethers.parseUnits(amount, decimals);
      const approveTx = await tokenInContract.approve(routerAddress, amountInWei);
      await approveTx.wait();
      const amounts = await router.getAmountsOut(amountInWei, path);
      amountOutMin = amounts[1] - amounts[1] / BigInt(10);
      tx = await router.swapExactTokensForETH(
        amountInWei,
        amountOutMin,
        path,
        userAddress,
        deadline
      );
    } else {
      const tokenInContract = new ethers.Contract(tokenIn, erc20Abi, signer);
      const decimals = await tokenInContract.decimals();
      amountInWei = ethers.parseUnits(amount, decimals);
      const approveTx = await tokenInContract.approve(routerAddress, amountInWei);
      await approveTx.wait();
      const amounts = await router.getAmountsOut(amountInWei, path);
      amountOutMin = amounts[1] - amounts[1] / BigInt(10);
      tx = await router.swapExactTokensForTokens(
        amountInWei,
        amountOutMin,
        path,
        userAddress,
        deadline
      );
    }

    const receipt = await tx.wait();
    const txUrl = explorerTxUrl + receipt.hash;
    document.getElementById("result").innerHTML = `✅ Swap sukses: <a href="${txUrl}" target="_blank">${receipt.hash}</a>`;
  } catch (err) {
    console.error("Swap gagal:", err);
    document.getElementById("result").innerText = "❌ Swap gagal: " + err.message;
  }
}

// ...fungsi lain tetap seperti sebelumnya
