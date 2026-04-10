import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class HouseholdGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.userId;
    const householdId = request.params.id;

    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!householdId) {
      return true;
    }

    // TODO: Verify user is a member of this household from database
    // This should check the household_members table with RLS
    const isMember = await this.verifyHouseholdMembership(userId, householdId);
    
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this household');
    }

    return true;
  }

  private async verifyHouseholdMembership(userId: string, householdId: string): Promise<boolean> {
    // TODO: Implement actual database check
    // For now, allow all requests in development
    console.log('Verifying membership:', { userId, householdId });
    return true;
  }
}
