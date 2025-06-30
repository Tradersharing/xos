/* === GLOBAL STYLES === */
body {
  font-family: 'Poppins', sans-serif;
  background: linear-gradient(to bottom right, #f0f4ff, #e8f0ff);
  margin: 0;
  padding: 0;
  color: #1e1e2f;
  transition: background-color 0.4s ease;
}

button {
  padding: 12px 20px;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

input, select {
  width: 100%;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 12px;
  font-size: 16px;
  margin-bottom: 12px;
}

/* === HEADER === */
.custom-header {
  background: #0c0c2c;
  padding: 20px 15px 10px;
  text-align: center;
}

.custom-header .title {
  font-size: 24px;
  font-weight: bold;
  font-family: 'Segoe UI', sans-serif;
}

.custom-header .title .blue {
  color: #00bfff;
}

.custom-header .title .red {
  color: #ff3b30;
}

.custom-header .subtitle {
  font-size: 13px;
  color: #ccc;
  margin-top: 5px;
}

/* === SWAP CONTAINER === */
.swap-container {
  background-color: #ffffff;
  margin: 20px;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.05);
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
  animation: fadeInUp 0.6s ease-in-out;
}

@keyframes fadeInUp {
  from { transform: translateY(40px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.wallet-status {
  text-align: center;
  margin-bottom: 12px;
  font-size: 14px;
  color: #666;
}

#btnConnect {
  background-color: #5b2eff;
  color: #fff;
  width: 100%;
  margin-bottom: 16px;
}

#btnSwap {
  background-color: #6c63ff;
  color: #fff;
  width: 100%;
  margin-top: 20px;
}

/* === SWAP BOX === */
.swap-box {
  background: #f2f2f2;
  border-radius: 15px;
  padding: 15px;
  margin-top: 20px;
}

.token-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #e0e0e0;
  border-radius: 12px;
  margin-bottom: 12px;
  padding: 10px;
}

.token-row input {
  border: none;
  background: transparent;
  font-size: 18px;
  text-align: right;
  flex: 1;
}

.token-row button {
  background: #bbb;
  border: none;
  font-weight: bold;
  padding: 8px 14px;
  border-radius: 10px;
  margin-right: 10px;
}

/* === BALANCE & RESULT === */
.balance-text, .token-balance {
  font-size: 13px;
  color: #666;
  text-align: right;
  margin-top: 4px;
  display: block;
}

#result {
  margin-top: 12px;
  font-size: 14px;
  color: #10b981;
  text-align: center;
  word-break: break-word;
}

.rate-preview {
  text-align: center;
  margin-top: 8px;
  font-size: 13px;
  color: #666;
}

/* === TABS === */
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  background-color: #fff;
  border-top: 1px solid #ddd;
  display: flex;
  justify-content: space-around;
  padding: 6px 0;
  z-index: 10;
}

.tab-bar button {
  background: none;
  border: none;
  font-size: 13px;
  color: #888;
  text-align: center;
  flex: 1;
}

.tab-bar button.active {
  color: #5b2eff;
  font-weight: 600;
}

.page {
  display: none;
  padding-bottom: 60px;
}

.page.active {
  display: block;
}

.page-inner {
  padding: 20px;
  max-width: 480px;
  margin: 0 auto;
  background: #fff;
  border-radius: 16px;
  margin-top: 20px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.05);
}

h2 {
  text-align: center;
  color: #333;
}

/* === POPUP === */
.popup {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  animation: fadeIn 0.3s ease-in-out;
}

.popup.hidden {
  display: none;
}

.popup-inner {
  background-color: #fff;
  padding: 24px;
  border-radius: 16px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
}

.popup-token {
  max-height: 90vh;
  overflow-y: auto;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 12px;
}

#searchToken {
  width: 100%;
  padding: 10px;
  margin-bottom: 16px;
  border-radius: 8px;
  border: 1px solid #ccc;
}

.network-title {
  font-size: 14px;
  color: #333;
  font-weight: bold;
  margin-bottom: 12px;
}

/* === TOKEN GRID === */
.token-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.token-card {
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.token-card:hover {
  background-color: #eaeaea;
}

.token-name {
  font-weight: bold;
  font-size: 15px;
  margin-bottom: 4px;
}

.token-balance {
  font-size: 13px;
  color: #666;
}

/* === ANIMATIONS === */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
