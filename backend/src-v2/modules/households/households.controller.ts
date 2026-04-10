import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { HouseholdsService } from './households.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { HouseholdGuard } from '../auth/guards/household.guard';

interface CreateHouseholdDto {
  name: string;
  currency?: string;
}

interface UpdateHouseholdDto {
  name?: string;
  currency?: string;
}

interface InviteMemberDto {
  email: string;
}

@Controller('api/households')
@UseGuards(AuthGuard)
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Post()
  async createHousehold(
    @Body() createDto: CreateHouseholdDto,
    @Headers('x-user-id') userId: string,
  ) {
    const currency = createDto.currency || 'EUR';
    return this.householdsService.createHousehold(createDto.name, currency, userId);
  }

  @Get()
  async getHouseholds(@Headers('x-user-id') userId: string) {
    return this.householdsService.getHouseholdsByUser(userId);
  }

  @Get(':id')
  @UseGuards(HouseholdGuard)
  async getHouseholdById(
    @Param('id') householdId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.householdsService.getHouseholdById(householdId, userId);
  }

  @Patch(':id')
  @UseGuards(HouseholdGuard)
  async updateHousehold(
    @Param('id') householdId: string,
    @Body() updateDto: UpdateHouseholdDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.householdsService.updateHousehold(householdId, updateDto, userId);
  }

  @Delete(':id')
  @UseGuards(HouseholdGuard)
  async deleteHousehold(
    @Param('id') householdId: string,
    @Headers('x-user-id') userId: string,
  ) {
    await this.householdsService.deleteHousehold(householdId, userId);
    return { success: true };
  }

  @Post(':id/invite')
  @UseGuards(HouseholdGuard)
  async inviteMember(
    @Param('id') householdId: string,
    @Body() inviteDto: InviteMemberDto,
    @Headers('x-user-id') userId: string,
  ) {
    const token = await this.householdsService.inviteMember(householdId, userId, inviteDto.email);
    return { inviteToken: token, link: `/households/invite/${token}` };
  }

  @Post('invite/accept')
  async acceptInvite(
    @Body('inviteToken') inviteToken: string,
    @Headers('x-user-id') userId: string,
  ) {
    await this.householdsService.acceptInvite(inviteToken, userId);
    return { success: true };
  }

  @Delete(':id/members/:userId')
  @UseGuards(HouseholdGuard)
  async removeMember(
    @Param('id') householdId: string,
    @Param('userId') targetUserId: string,
    @Headers('x-user-id') userId: string,
  ) {
    await this.householdsService.removeMember(householdId, userId, targetUserId);
    return { success: true };
  }

  @Patch(':id/members/:userId/role')
  @UseGuards(HouseholdGuard)
  async updateMemberRole(
    @Param('id') householdId: string,
    @Param('userId') targetUserId: string,
    @Body('role') newRole: 'owner' | 'member',
    @Headers('x-user-id') userId: string,
  ) {
    await this.householdsService.updateMemberRole(householdId, userId, targetUserId, newRole);
    return { success: true };
  }
}
