const JWT_SECRET = process.env.JWT_SECRET || 'examchain_secret_key';

if (!process.env.JWT_SECRET) {
  console.warn('[SECURITY WARNING] JWT_SECRET is not set in the environment — falling back to an insecure default. Set JWT_SECRET in your .env (and in your hosting provider\'s environment variables) before deploying.');
}

module.exports = JWT_SECRET;
