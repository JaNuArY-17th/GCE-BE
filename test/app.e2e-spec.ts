import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(() => {
    jest.setTimeout(30000)
  })

  beforeEach(async () => {
    // Ensure env credentials are available for auth
    process.env.ADMIN_USERNAME = 'admin'
    process.env.ADMIN_PASSWORD = 'GCA2025Admin@'
    process.env.JWT_SECRET = 'test-secret'

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/api/categories (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/categories')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true)
        expect(res.body.length).toBeGreaterThan(0)
      })
  })

  it('/api/categories/:id/nominees (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/categories/fanpage/nominees')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true)
        expect(res.body.length).toBeGreaterThan(0)
      })
  })

  let accessToken: string

  it('/api/auth/login (POST) sets refresh cookie and returns accessToken', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'GCA2025Admin@' })
      .expect(201)

    expect(res.body).toHaveProperty('accessToken')
    expect(res.body).toHaveProperty('expiresIn')
    expect(res.body.tokenType).toBe('Bearer')
    expect(res.headers['set-cookie']).toBeDefined()

    accessToken = res.body.accessToken
  })

  it('/api/auth/refresh (POST) rotates refresh token and returns new access token', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'GCA2025Admin@' })
      .expect(201)

    const cookie = loginRes.headers['set-cookie']?.[0]
    expect(cookie).toBeDefined()

    const cookieValue = cookie.split(';')[0]

    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookieValue)
      .expect(201)

    expect(res.body).toHaveProperty('accessToken')
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('/api/votes (POST) requires google-auth verification', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'GCA2025Admin@' })
      .expect(201)

    const accessToken = loginRes.body.accessToken
    const authHeader = `Bearer ${accessToken}`

    const nomineesRes = await request(app.getHttpServer())
      .get('/api/categories/fanpage/nominees')
      .expect(200)

    const nomineeId = nomineesRes.body?.[0]?.id
    expect(nomineeId).toBeTruthy()

    const newMssv = `test${Date.now()}`
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', authHeader)
      .send({ fullname: 'Test Voter', mssv: newMssv, email: 'student@example.com' })
      .expect(201)

    // In test mode we allow any idToken; server ignores it when NODE_ENV=test
    return request(app.getHttpServer())
      .post('/api/votes')
      .send({ voteId: 'fanpage', nomineeId, mssv: newMssv, idToken: 'dummy' })
      .expect(201)
      .expect({ success: true })
  })

  it('/api/votes/:id/results (GET)', async () => {
    const nomineesRes = await request(app.getHttpServer())
      .get('/api/categories/fanpage/nominees')
      .expect(200)

    const nomineeId = nomineesRes.body?.[0]?.id
    expect(nomineeId).toBeTruthy()

    return request(app.getHttpServer())
      .get('/api/votes/fanpage/results')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty(nomineeId)
      })
  })
})
