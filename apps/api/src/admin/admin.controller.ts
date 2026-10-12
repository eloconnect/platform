import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/enums';
import { Roles } from '../auth/roles.decorator';
import type { AuthRequest } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import { AdminService } from './admin.service';
import { AdminOverviewQueryDto } from './dto/admin-overview-query.dto';
import { CreateContributionProposalDto } from './dto/create-contribution-proposal.dto';
import { DecideContributionProposalDto } from './dto/decide-contribution-proposal.dto';
import { SaveBenefitDto } from './dto/save-benefit.dto';
import { SaveConventionDto } from './dto/save-convention.dto';

@Controller('admin')
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  getOverview(@Query() query: AdminOverviewQueryDto) {
    return this.adminService.getOverview(query);
  }

  @Get('registrations')
  @Header('Cache-Control', 'no-store')
  getRegistrations() {
    return this.adminService.getRegistrations();
  }

  @Post('registrations/:id/approve')
  approveRegistration(@Req() request: AuthRequest, @Param('id') id: string) {
    return this.adminService.approveRegistration(request.authUser!.id, id);
  }

  @Post('registrations/:id/welcome-email')
  resendRegistrationWelcomeEmail(
    @Req() request: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.adminService.resendRegistrationWelcomeEmail(
      request.authUser!.id,
      id,
    );
  }

  @Get('contributions')
  @Header('Cache-Control', 'no-store')
  getContributions() {
    return this.adminService.getContributions();
  }

  @Post('contribution-proposals')
  createContributionProposal(
    @Req() request: AuthRequest,
    @Body() dto: CreateContributionProposalDto,
  ) {
    return this.adminService.createContributionProposal(
      request.authUser!.id,
      dto,
    );
  }

  @Patch('contribution-proposals/:id/decision')
  decideContributionProposal(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() dto: DecideContributionProposalDto,
  ) {
    return this.adminService.decideContributionProposal(
      request.authUser!.id,
      id,
      dto,
    );
  }

  @Get('conventions')
  @Header('Cache-Control', 'no-store')
  getConventions() {
    return this.adminService.getConventions();
  }

  @Post('conventions')
  createConvention(
    @Req() request: AuthRequest,
    @Body() dto: SaveConventionDto,
  ) {
    return this.adminService.createConvention(request.authUser!.id, dto);
  }

  @Patch('conventions/:id')
  updateConvention(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() dto: SaveConventionDto,
  ) {
    return this.adminService.updateConvention(request.authUser!.id, id, dto);
  }

  @Get('benefits')
  @Header('Cache-Control', 'no-store')
  getBenefits() {
    return this.adminService.getBenefits();
  }

  @Post('benefits')
  createBenefit(@Req() request: AuthRequest, @Body() dto: SaveBenefitDto) {
    return this.adminService.createBenefit(request.authUser!.id, dto);
  }

  @Patch('benefits/:id')
  updateBenefit(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() dto: SaveBenefitDto,
  ) {
    return this.adminService.updateBenefit(request.authUser!.id, id, dto);
  }
}
