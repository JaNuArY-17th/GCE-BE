import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppController } from '@app/app.controller';
import { AppService } from '@app/app.service';
import { DatabaseModule } from '@database/database.module';
import { VotesModule } from '@modules/votes/votes.module';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { CategoriesModule } from '@modules/categories/categories.module';
import { NomineesModule } from '@modules/nominees/nominees.module';
import { MediaModule } from '@modules/media/media.module';

@Module({
  imports: [
    DatabaseModule,
    VotesModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    NomineesModule,
    MediaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(cookieParser()).forRoutes('*');
  }
}
