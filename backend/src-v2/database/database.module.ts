import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'DATABASE',
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get<string>('DATABASE_URL');
        if (!connectionString) {
          throw new Error('DATABASE_URL environment variable is required');
        }
        const sql = neon(connectionString);
        const db: NeonHttpDatabase = drizzle(sql);
        return db;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['DATABASE'],
})
export class DatabaseModule {}
