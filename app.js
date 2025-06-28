
let provider, signer, user;

// Auto-switch to XOS testnet (chainId: 0x84F = 2127)
async function switchToXOS() {
  const xosChain = {
    chainId: '0x84F',
    chainName: 'XOS Testnet',
    rpcUrls: ['https://rpc-testnet.xoslab.org'],
    nativeCurrency: {
      name: 'XOS',
      symbol: 'XOS',
      decimals: 18
    },
    blockExplorerUrls: ['https://testnet-scan.xoslab.org']
  };

  try {
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [xosChain]
    });
  } catch (err) {
    console.error("Error switching chain:", err);
  }
}

async function connectWallet() {
  if (!window.ethereum) return alert("Install MetaMask or OKX Wallet!");
  await switchToXOS();

  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  user = await signer.getAddress();

  // Signature login
  const msg = `Login to XOS Swap DApp\n${new Date().toLocaleString()}`;
  await signer.signMessage(msg);

  // Update UI
  document.getElementById("walletStatus").innerText = "Connected: " + user.slice(0, 6) + "...";
  document.getElementById("btnConnect").innerText = "✅ Connected";
  document.getElementById("btnConnect").disabled = true;
  document.querySelector("button[onclick='doSwap()']").disabled = false;
}

async function doSwap() {
  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;
  const amount = ethers.parseUnits(document.getElementById("amount").value, 18);
  const routerAddress = "0x778dBa0703801c4212dB2715b3a7b9c6D42Cf703";

  const routerABI = [
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory)"
  ];
  const tokenABI = ["function approve(address spender, uint amount) external returns (bool)"];

  try {
    // ✅ Connect contract dengan signer!
    const token = new ethers.Contract(tokenIn, tokenABI, provider).connect(signer);
    await token.approve(routerAddress, amount);

    const router = new ethers.Contract(routerAddress, routerABI, provider).connect(signer);
    const path = [tokenIn, tokenOut];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

    const tx = await router.swapExactTokensForTokens(amount, 0, path, user, deadline);
    await tx.wait();

    document.getElementById("result").innerText = "✅ Swap Success!";
  } catch (err) {
    document.getElementById("result").innerText = "❌ Swap Failed: " + err.message;
    console.error(err);
  }
}
