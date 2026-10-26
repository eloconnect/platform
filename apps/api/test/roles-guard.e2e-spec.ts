// O RolesGuard valida o token e o perfil (RF02). Não usa o banco.
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { Roles } from '../src/auth/decorators/roles.decorator.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';

const SEGREDO = 'segredo-so-para-teste-com-mais-de-32-caracteres';

@Controller('so-admin-no-metodo')
@UseGuards(RolesGuard)
class SoAdminNoMetodo {
  @Get()
  @Roles('ADMIN')
  ler() {
    return { ok: true };
  }
}

@Controller('so-admin-na-classe')
@UseGuards(RolesGuard)
@Roles('ADMIN')
class SoAdminNaClasse {
  @Get()
  ler() {
    return { ok: true };
  }
}

describe('RolesGuard', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  const token = (perfil: string, expiresIn = 60) =>
    jwt.signAsync({ perfil }, { secret: SEGREDO, subject: 'id', expiresIn });

  beforeAll(async () => {
    process.env.JWT_SECRET = SEGREDO;
    const modulo = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        JwtModule.register({}),
      ],
      controllers: [SoAdminNoMetodo, SoAdminNaClasse],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    jwt = modulo.get(JwtService);
  });

  afterAll(() => app.close());

  it('recusa sem token (401)', () =>
    request(app.getHttpServer()).get('/so-admin-na-classe').expect(401));

  it('recusa token inválido (401)', () =>
    request(app.getHttpServer())
      .get('/so-admin-na-classe')
      .set('Authorization', 'Bearer abc')
      .expect(401));

  it('recusa token expirado (401)', async () =>
    request(app.getHttpServer())
      .get('/so-admin-na-classe')
      .set('Authorization', `Bearer ${await token('ADMIN', -10)}`)
      .expect(401));

  it('recusa perfil errado com @Roles no método (403)', async () =>
    request(app.getHttpServer())
      .get('/so-admin-no-metodo')
      .set('Authorization', `Bearer ${await token('ASSOCIADO')}`)
      .expect(403));

  it('recusa perfil errado com @Roles na classe (403)', async () =>
    request(app.getHttpServer())
      .get('/so-admin-na-classe')
      .set('Authorization', `Bearer ${await token('ASSOCIADO')}`)
      .expect(403));

  it('aceita o perfil certo', async () =>
    request(app.getHttpServer())
      .get('/so-admin-na-classe')
      .set('Authorization', `Bearer ${await token('ADMIN')}`)
      .expect(200));
});
