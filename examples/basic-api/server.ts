import express from 'express';
import { ServiceInitializer } from '../../src/core/handler'; // Wait, ServiceInitializer is in src/core/service-initializer
import { PrismaClient } from '@prisma/client';
import userRouter from './app/api/users/route';

async function startServer() {
  // Use the global prisma instance for handlers
  (global as any).prisma = new PrismaClient();

  // In a real app, you would use ServiceInitializer.initialize()
  // but for a simple example, we can just start express.
  
  const app = express();
  app.use(express.json());

  // Mount the user routes
  app.use('/api/users', userRouter);

  const PORT = 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Basic API Example running on http://localhost:${PORT}`);
    console.log(`👤 User routes available at http://localhost:${PORT}/api/users`);
  });
}

startServer().catch(console.error);
