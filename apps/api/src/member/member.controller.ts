import {
  Controller,
  Body,
  Get,
  Header,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/enums';
import { Roles } from '../auth/roles.decorator';
import type { AuthRequest } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import { MemberService } from './member.service';
import { RequestCancellationDto } from './dto/request-cancellation.dto';

@Controller('member')
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ASSOCIATE)
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  getOverview(@Req() request: AuthRequest) {
    return this.memberService.getOverview(request.authUser!.id);
  }

  @Get('bills')
  @Header('Cache-Control', 'no-store')
  getBills(@Req() request: AuthRequest) {
    return this.memberService.getBills(request.authUser!.id);
  }

  @Get('benefits')
  @Header('Cache-Control', 'no-store')
  getBenefits(@Req() request: AuthRequest) {
    return this.memberService.getBenefits(request.authUser!.id);
  }

  @Get('conventions')
  @Header('Cache-Control', 'no-store')
  getConventions(@Req() request: AuthRequest) {
    return this.memberService.getConventions(request.authUser!.id);
  }

  @Get('news')
  @Header('Cache-Control', 'no-store')
  getNews() {
    return this.memberService.getNews();
  }

  @Get('support')
  @Header('Cache-Control', 'no-store')
  getSupport(@Req() request: AuthRequest) {
    return this.memberService.getSupport(request.authUser!.id);
  }

  @Post('cancellation')
  @Header('Cache-Control', 'no-store')
  requestCancellation(
    @Req() request: AuthRequest,
    @Body() dto: RequestCancellationDto,
  ) {
    return this.memberService.requestCancellation(
      request.authUser!.id,
      dto.confirmed,
    );
  }
}
