const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const bedRoutes = require('./routes/bedRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const residentRoutes = require('./routes/residentRoutes');
const messRoutes = require('./routes/messRoutes');
const checkoutRoutes = require('./routes/checkoutRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminDashboardRoutes = require('./routes/adminDashboardRoutes');
const saasRoutes = require('./routes/saasRoutes');
const platformRoutes = require('./routes/platformRoutes');
const onboardingRoutes = require('./modules/onboarding/onboarding.routes');
const maintenanceRoutes = require('./modules/maintenance/maintenance.routes');
const aiRoutes = require('./modules/ai/ai.routes');
const publicRoutes = require('./modules/public/public.routes');
const tenantMiddleware = require('./middleware/tenantMiddleware');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
const allowedOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map((value) => value.trim()) : null;
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || !allowedOrigins) return callback(null, true);
    return callback(null, allowedOrigins.includes(origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));

app.use('/api', healthRoutes);
// Public marketplace: NO tenant context required until a booking is requested.
app.use('/api/public', publicRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/beds', bedRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/residents', residentRoutes);
app.use('/api/mess', messRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminDashboardRoutes);
app.use('/api/maintenance', tenantMiddleware, maintenanceRoutes);
app.use('/api/ai', tenantMiddleware, aiRoutes);

app.use('/api/platform', tenantMiddleware, platformRoutes);
app.use('/api/v1', saasRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Internal Server Error',
    ...(err.details ? { details: err.details } : {}),
  });
});

module.exports = app;
