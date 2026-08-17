const authService = require('../services/auth.service');
const env = require('../config/env');

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

async function register(req, res, next) {
  try {
    const { email, password, name, phone } = req.body;
    const { user, token } = await authService.registerUser({ email, password, name, phone });
    setAuthCookie(res, token);
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user,
      token
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.loginUser({ email, password });
    setAuthCookie(res, token);
    return res.status(200).json({
      success: true,
      user,
      token
    });
  } catch (err) {
    next(err);
  }
}

async function googleAuth(req, res, next) {
  try {
    const payload = req.body;
    const { user, token } = await authService.googleAuth(payload);
    setAuthCookie(res, token);
    return res.status(200).json({
      success: true,
      user,
      token
    });
  } catch (err) {
    next(err);
  }
}

async function adminLogin(req, res, next) {
  try {
    const { email, password, secretKey } = req.body;
    const { user, token } = await authService.adminLogin({ email, password, secretKey });
    setAuthCookie(res, token);
    return res.status(200).json({
      success: true,
      user,
      token
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.getUserProfile(req.user.id);
    return res.status(200).json({
      success: true,
      user
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/'
  });
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
}

module.exports = {
  register,
  login,
  googleAuth,
  adminLogin,
  getMe,
  logout
};
