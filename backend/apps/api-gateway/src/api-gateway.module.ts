import { Module } from '@nestjs/common';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { HotelModule } from './hotel/hotel.module';
import { BookingController } from './booking/booking.controller';
import { PaymentController } from './payment/payment.controller';
import { ChatBotController } from './chat-bot/chat-bot.controller';
import { ChatBotModule } from './chat-bot/chat-bot.module';
import { PaymentModule } from './payment/payment.module';
import { BookingModule } from './booking/booking.module';

@Module({
  imports: [AuthModule, UserModule, HotelModule, ChatBotModule, PaymentModule, BookingModule],
  controllers: [ApiGatewayController],
  providers: [ApiGatewayService],
})
export class ApiGatewayModule {}
