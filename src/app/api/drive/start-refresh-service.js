import { startTokenRefreshService } from './token-refresh-service';

// Tự động khởi động service khi file này được import
startTokenRefreshService();

console.log('Token refresh service initialization completed'); 