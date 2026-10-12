import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { Perfil } from '../generated/prisma/enums';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { SESSION_COOKIE_NAME } from './auth.constants';
import request from 'supertest';

describe('AuthController', () => {
  const sessionToken = 'opaque-session-token';
  const user = {
    id: 'user-id',
    email: 'admin@example.com',
    nome: 'Admin',
    perfil: Perfil.ADMIN,
  };
  const authService = {
    login: jest.fn(),
    getSession: jest.fn(),
    logout: jest.fn(),
  };
  let app: INestApplication;

  beforeAll(async () => {
    authService.login.mockResolvedValue({
      token: sessionToken,
      expiresAt: new Date(Date.now() + 60_000),
      user,
      sessionId: 'session-id',
    });
    authService.getSession.mockResolvedValue({
      sessionId: 'session-id',
      user,
    });
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        AuthModule,
      ],
    })
      .overrideProvider(AuthService)
      .useValue(authService)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    authService.login.mockClear();
    authService.getSession.mockClear();
    authService.logout.mockClear();
  });

  it('sets an HttpOnly session cookie and only returns the user', async () => {
    const agent = request.agent(app.getHttpServer());
    const response = await agent.post('/api/auth/login').send({
      email: 'admin@example.com',
      password: 'SenhaForte123!',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user });
    expect(response.headers['set-cookie'][0]).toContain(
      `${SESSION_COOKIE_NAME}=${sessionToken}`,
    );
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
    expect(JSON.stringify(response.body)).not.toContain(sessionToken);

    const currentUser = await agent.get('/api/auth/me');
    expect(currentUser.status).toBe(200);
    expect(currentUser.body).toEqual({ user });
    expect(authService.getSession).toHaveBeenCalledWith(sessionToken);
  });

  it('revokes the cookie session and clears the browser cookie on logout', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({
      email: 'admin@example.com',
      password: 'SenhaForte123!',
    });

    const response = await agent.post('/api/auth/logout');
    expect(response.status).toBe(204);
    expect(authService.logout).toHaveBeenCalledWith(sessionToken);
    expect(response.headers['set-cookie'][0]).toContain(
      `${SESSION_COOKIE_NAME}=`,
    );
    expect(response.headers['set-cookie'][0]).toContain(
      'Expires=Thu, 01 Jan 1970',
    );
  });
});
