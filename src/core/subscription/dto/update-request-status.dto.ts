import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionRequestStatus } from '@/shared/enums/subscription-request-status.enum';

export class UpdateRequestStatusRequest {
  @ApiProperty({
    enum: SubscriptionRequestStatus,
    example: SubscriptionRequestStatus.ACCEPTED,
    description: '`accepted` means an admin has contacted the customer; it grants no entitlement on its own.',
  })
  @IsEnum(SubscriptionRequestStatus)
  status: SubscriptionRequestStatus;
}
