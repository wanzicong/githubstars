/**
 * 测试事务隔离工具
 * 每个测试用例包裹在 MySQL 事务中，afterEach 回滚，保证零数据污染。
 *
 * 用法:
 *   let tx: TestTransaction
 *   beforeEach(async () => { tx = new TestTransaction(prisma); await tx.begin() })
 *   afterEach(async () => { await tx.rollback() })
 */
import { PrismaService } from '../../src/prisma/prisma.service'

export class TestTransaction {
  constructor(private readonly prisma: PrismaService) {}

  async begin(): Promise<void> {
    await this.prisma.$executeRaw`START TRANSACTION`
  }

  async rollback(): Promise<void> {
    await this.prisma.$executeRaw`ROLLBACK`
  }

  async commit(): Promise<void> {
    await this.prisma.$executeRaw`COMMIT`
  }
}

/**
 * 为集成测试创建 NestJS TestingModule 的工厂函数
 * 用法:
 *   const { app, prisma } = await createTestingApp()
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { AppModule } from '../../src/app.module'

export async function createTestingApp(): Promise<{
  app: INestApplication
  prisma: PrismaService
  module: TestingModule
}> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleFixture.createNestApplication()
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  await app.init()

  const prisma = moduleFixture.get<PrismaService>(PrismaService)
  return { app, prisma, module: moduleFixture }
}
