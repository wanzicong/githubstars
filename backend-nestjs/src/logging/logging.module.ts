import { Global, Module } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { LoggingController } from './logging.controller';

@Global()
@Module({
    providers: [LoggingService],
    exports: [LoggingService],
    controllers: [LoggingController],
})
export class LoggingModule {}
