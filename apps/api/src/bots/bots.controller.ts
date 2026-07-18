import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor, AnyFilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { BotsService } from './bots.service';

@Controller('bots')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TENANT_ADMIN', 'STAFF')
export class BotsController {
  constructor(private service: BotsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.tenantId!);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; type?: 'auto' | 'manual'; phoneNumber?: string },
  ) {
    return this.service.create(user.tenantId!, body);
  }

  // Aggregate group subscriptions (declared before ':id' routes).
  @Get('subscriptions/groups')
  groupSubscriptions(@CurrentUser() user: AuthUser) {
    return this.service.groupSubscriptions(user.tenantId!);
  }

  // ── Bot creator ──
  @Post('ai-generate')
  aiGenerate(@CurrentUser() user: AuthUser, @Body() body: { prompt: string }) {
    return this.service.aiGenerate(user.tenantId!, body?.prompt || '');
  }

  @Post('scaffold')
  scaffold(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; base?: 'modelo' | 'ponte' | 'vazio'; phoneNumber?: string; extraFiles?: { name: string; content: string }[] },
  ) {
    return this.service.scaffold(user.tenantId!, body);
  }

  @Get('template/download')
  downloadTemplate(@Res() res: Response) {
    return this.service.downloadTemplate(res);
  }

  @Get('bridge/download')
  downloadBridge(@Res() res: Response) {
    return this.service.downloadBridge(res);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.get(user.tenantId!, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { name?: string; phoneNumber?: string | null; config?: any },
  ) {
    return this.service.update(user.tenantId!, id, body);
  }

  @Post(':id/start')
  start(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.start(user.tenantId!, id);
  }

  @Post(':id/stop')
  stop(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.stop(user.tenantId!, id);
  }

  @Post(':id/restart')
  restart(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.restart(user.tenantId!, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.tenantId!, id);
  }

  @Get(':id/live')
  live(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.live(user.tenantId!, id);
  }

  @Post(':id/logs/clear')
  clearLogs(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.clearLogs(user.tenantId!, id);
  }

  @Get(':id/download')
  download(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    return this.service.downloadProject(user.tenantId!, id, res);
  }

  @Get(':id/script')
  getScript(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getScript(user.tenantId!, id);
  }

  @Post(':id/script')
  saveScript(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.service.saveScript(user.tenantId!, id, body.content ?? '');
  }

  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file?: { buffer: Buffer; originalname: string },
  ) {
    return this.service.saveProjectZip(user.tenantId!, id, file?.buffer);
  }

  // Folder / multiple-file upload. Each file's relative path comes from its
  // multipart field name (the frontend uses webkitRelativePath).
  @Post(':id/files')
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: 100 * 1024 * 1024, files: 500 } }))
  uploadFiles(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFiles() files: Array<{ buffer: Buffer; originalname: string; fieldname: string }>,
  ) {
    const mapped = (files || []).map((f) => ({ rel: f.fieldname || f.originalname, buffer: f.buffer }));
    return this.service.saveFiles(user.tenantId!, id, mapped);
  }

  // ── File manager ──
  @Get(':id/files')
  listFiles(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.listFiles(user.tenantId!, id);
  }

  @Get(':id/file')
  readFile(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('path') p: string) {
    return this.service.readFile(user.tenantId!, id, p || '');
  }

  @Post(':id/file')
  writeFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { path: string; content: string },
  ) {
    return this.service.writeFileContent(user.tenantId!, id, body.path, body.content ?? '');
  }

  @Delete(':id/file')
  deleteFile(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('path') p: string) {
    return this.service.deletePath(user.tenantId!, id, p || '');
  }

  @Get(':id/file/history')
  fileHistory(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('path') p: string) {
    return this.service.fileHistory(user.tenantId!, id, p || '');
  }

  @Post(':id/file/revert')
  revertFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { path: string; version: string },
  ) {
    return this.service.revertFile(user.tenantId!, id, body.path, body.version);
  }

  @Post(':id/broadcast')
  broadcast(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { message: string; audience?: 'all' | 'recent30' },
  ) {
    return this.service.broadcast(user.tenantId!, id, body.message, body.audience ?? 'all');
  }

  @Post(':id/command')
  command(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { command: string }) {
    return this.service.sendCommand(user.tenantId!, id, body.command ?? '');
  }

  // ── Manual group registration ──
  @Post(':id/groups')
  addGroup(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { id: string; name?: string; description?: string; plan?: string; validUntil?: string; admins?: string[]; services?: string[] },
  ) {
    return this.service.addGroup(user.tenantId!, id, body);
  }

  @Post(':id/groups/sync')
  syncGroups(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.requestSync(user.tenantId!, id);
  }

  @Post(':id/groups/:groupId/renew')
  renewGroup(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Body() body: { months?: number },
  ) {
    return this.service.renewGroup(user.tenantId!, id, groupId, body?.months ?? 1);
  }

  @Delete(':id/groups/:groupId')
  removeGroup(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('groupId') groupId: string) {
    return this.service.removeGroup(user.tenantId!, id, groupId);
  }

  @Post(':id/stdin')
  stdin(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { input: string }) {
    return this.service.sendStdin(user.tenantId!, id, body.input ?? '');
  }
}
