import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { HouseholdsModule } from './households/households.module';
import { ListsModule } from './lists/lists.module';
import { ItemsModule } from './items/items.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { BudgetsModule } from './budgets/budgets.module';
import { PricesModule } from './prices/prices.module';
import { AiModule } from './ai/ai.module';
import { ActivityModule } from './activity/activity.module';
import { WebSocketsModule } from './websockets/websockets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    AuthModule,
    HouseholdsModule,
    ListsModule,
    ItemsModule,
    ReceiptsModule,
    BudgetsModule,
    PricesModule,
    AiModule,
    ActivityModule,
    WebSocketsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
