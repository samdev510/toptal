import app from './app';
import { env } from './config/env';
import { cleanupExpiredCarts } from './modules/cart/cart.service';

const PORT = env.PORT;

app.listen(PORT, () => {
  console.info(`API listening on http://localhost:${PORT}`);
});

// drop cart holds older than 30 min
setInterval(() => {
  cleanupExpiredCarts().catch((err) => console.error('cart cleanup failed', err));
}, 5 * 60 * 1000);
