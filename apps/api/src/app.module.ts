import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ProductsModule } from './products/products.module';
import { ApiKeysModule } from './apikeys/apikeys.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { BotsModule } from './bots/bots.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TeamModule } from './team/team.module';
import { SupportModule } from './support/support.module';
import { BroadcastModule } from './broadcast/broadcast.module';
import { IngestModule } from './ingest/ingest.module';
import { TenantsModule } from './tenants/tenants.module';
import { PlatformModule } from './platform/platform.module';
import { CatalogModule } from './catalog/catalog.module';
import { ReportsModule } from './reports/reports.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    SeedModule,
    HealthModule,
    AuthModule,
    // Tenant (revendedor) panel
    DashboardModule,
    TransactionsModule,
    ProductsModule,
    ApiKeysModule,
    SubscriptionModule,
    BotsModule,
    NotificationsModule,
    TeamModule,
    SupportModule,
    BroadcastModule,
    // MacroDroid ingestion
    IngestModule,
    // Super Admin panel
    TenantsModule,
    PlatformModule,
    CatalogModule,
    ReportsModule,
  ],
})
export class AppModule {}
