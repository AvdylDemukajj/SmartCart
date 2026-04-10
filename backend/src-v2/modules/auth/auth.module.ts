import { Module } from '@nestjs/common';
import { AuthGuard } from './guards/auth.guard';
import { HouseholdGuard } from './guards/household.guard';

@Module({
  providers: [AuthGuard, HouseholdGuard],
  exports: [AuthGuard, HouseholdGuard],
})
export class AuthModule {}
