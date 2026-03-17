import 'dotenv/config'
import 'tsconfig-paths/register'
import cookieParser from 'cookie-parser'
import { NestFactory } from '@nestjs/core'
import { DataSource } from 'typeorm'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from '@app/app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  // Ensure DB connection works early and log status clearly
  try {
    const dataSource = app.get(DataSource)
    console.log('DB config (env):', {
      DATABASE_URL: process.env.DATABASE_URL,
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_USER: process.env.DB_USER,
      DB_NAME: process.env.DB_NAME,
    })

    if (!dataSource.isInitialized) {
      await dataSource.initialize()
      console.log('Database connection: OK')
    } else {
      console.log('Database connection: already initialized')
    }

    // Run migrations automatically (useful for development)
    await dataSource.runMigrations()
    console.log('Migrations: OK')
  } catch (err) {
    console.error('Database startup error:', err)
    process.exit(1)
  }

  // Enable cookie parsing so refresh tokens can be read from HttpOnly cookies
  app.use(cookieParser())

  // Keep API routes behind a common prefix to align with frontend expectations
  app.setGlobalPrefix('api')

  // Allow frontend development servers (Vite, CRA, etc.) to connect
  app.enableCors({
    origin: true,
    credentials: true,
  })

  await app.listen(process.env.PORT ?? 3000)
}

bootstrap()
