// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  applyDeleteFilesManifest,
  DEFAULT_DEV_API_URL,
  isSecretEnvFile,
  mergeHeadlessGeminiSettings,
  resolveCloudApiUrl,
  runPreCommitSecretGuard,
  runWorkspaceGuardCli,
  setupCloudEnvironment,
  unstageCloudWorkspaceLocks,
} from './workspace-guard.mjs';

const NUL = String.fromCharCode(0);
const LF = String.fromCharCode(10);
const BS = String.fromCharCode(92);

describe('scripts/cloud/workspace-guard', () => {
  describe('isSecretEnvFile & unstageCloudWorkspaceLocks', () => {
    it('identifies secret .env files while preserving .env.example, .env.sample, and .env.template', () => {
      expect(isSecretEnvFile('.env')).toBe(true);
      expect(isSecretEnvFile('.env.local')).toBe(true);
      expect(isSecretEnvFile('.env.development.local')).toBe(true);
      expect(isSecretEnvFile('.env.e2e.local')).toBe(true);
      expect(isSecretEnvFile(`apps${BS}web${BS}.env.production`)).toBe(true);

      expect(isSecretEnvFile('.env.example')).toBe(false);
      expect(isSecretEnvFile('.env.sample')).toBe(false);
      expect(isSecretEnvFile('.env.template')).toBe(false);
      expect(isSecretEnvFile('config/.env.example')).toBe(false);
      expect(isSecretEnvFile('src/env.ts')).toBe(false);
    });

    it('unstages secret .env files and workspace locks via CommandPort while keeping .env.example and .env.template staged', () => {
      const gitCalls = [];
      const port = {
        git: vi.fn((args) => {
          gitCalls.push(args.join(' '));
          if (args[0] === 'diff' && args[1] === '--cached') {
            return [
              '.env',
              '.env.development.local',
              'packages/app/.env.local',
              '.env.example',
              '.env.template',
              'src/index.ts',
            ].join(LF);
          }
          return '';
        }),
        gh: vi.fn(() => ''),
      };

      const res = unstageCloudWorkspaceLocks({
        cwd: '/repo',
        port,
        restoreWorktree: true,
      });

      expect(res.unstaged).toEqual([
        '.env',
        '.env.development.local',
        'packages/app/.env.local',
      ]);
      expect(gitCalls).toContain('update-index --no-skip-worktree .gitignore');
      expect(gitCalls).toContain(
        'update-index --no-skip-worktree .gemini/settings.json'
      );
      expect(gitCalls).toContain('reset -- .env');
      expect(gitCalls).toContain('reset -- .env.development.local');
      expect(gitCalls).toContain('reset -- packages/app/.env.local');
      expect(gitCalls).not.toContain('reset -- .env.example');
      expect(gitCalls).not.toContain('reset -- .env.template');
      expect(gitCalls).not.toContain('reset -- src/index.ts');
      expect(gitCalls).toContain('checkout HEAD -- .gitignore');
      expect(gitCalls).toContain('checkout HEAD -- .gemini/settings.json');
    });
  });

  describe('setupCloudEnvironment & mergeHeadlessGeminiSettings', () => {
    it('derives API URL from BFF_OPENAPI_URL, writes .env*.local, merges .gemini/settings.json tools.exclude, and locks .gitignore', async () => {
      expect(resolveCloudApiUrl({})).toBe(DEFAULT_DEV_API_URL);
      expect(
        resolveCloudApiUrl({
          BFF_OPENAPI_URL: 'https://api.xtalent.dev/v1/openapi.json',
        })
      ).toBe('https://api.xtalent.dev/v1/api');
      expect(
        resolveCloudApiUrl({
          BFF_OPENAPI_URL: 'https://api.xtalent.dev/api/openapi.json',
        })
      ).toBe('https://api.xtalent.dev/api');

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-guard-setup-'));
      try {
        fs.mkdirSync(path.join(tmpDir, '.gemini'), { recursive: true });
        fs.mkdirSync(path.join(tmpDir, '.git', 'info'), { recursive: true });
        fs.writeFileSync(
          path.join(tmpDir, '.gitignore'),
          ['node_modules/', '/.agents/tmp/', '.next/'].join(LF),
          'utf8'
        );
        fs.writeFileSync(
          path.join(tmpDir, '.gemini', 'settings.json'),
          JSON.stringify({
            model: { name: 'gemini-4-carbon' },
            mcpServers: { figma: { command: 'npx' } },
            hooks: { PreToolUse: [] },
            tools: { exclude: ['custom_dangerous_tool', 'web_fetch'] },
          }),
          'utf8'
        );

        const gitCalls = [];
        const port = {
          git: vi.fn((args) => {
            gitCalls.push(args);
            return '';
          }),
          gh: vi.fn(() => ''),
        };

        await setupCloudEnvironment({
          cwd: tmpDir,
          port,
          env: {
            BFF_OPENAPI_URL: 'https://bff.example.com/stage/openapi.json',
            NEXTAUTH_SECRET: 'sec_123',
            GEMINI_API_KEY: 'gem_456',
            E2E_MENTOR_EMAIL: 'mentor@test.dev',
            E2E_MENTOR_PASSWORD: 'pw1',
            E2E_MENTEE_EMAIL: 'mentee@test.dev',
            E2E_MENTEE_PASSWORD: 'pw2',
          },
        });

        // Call a second time with empty env (as in cloud-fix-pr Phase 1)
        // to verify idempotency and secret preservation.
        await setupCloudEnvironment({
          cwd: tmpDir,
          port,
          env: {},
        });

        const devEnv = fs.readFileSync(
          path.join(tmpDir, '.env.development.local'),
          'utf8'
        );
        expect(devEnv).toContain(
          'NEXT_PUBLIC_API_URL=https://bff.example.com/stage/api'
        );
        expect(devEnv).toContain('NEXTAUTH_SECRET=sec_123');
        expect(devEnv).toContain('DESIGN_AUDIT_MENTOR_EMAIL=mentor@test.dev');
        expect(devEnv).toContain(
          'BFF_OPENAPI_URL=https://bff.example.com/stage/openapi.json'
        );

        const e2eEnv = fs.readFileSync(
          path.join(tmpDir, '.env.e2e.local'),
          'utf8'
        );
        expect(e2eEnv).toContain(
          'NEXT_PUBLIC_API_URL=https://bff.example.com/stage/api'
        );
        expect(e2eEnv).toContain('E2E_MENTOR_EMAIL=mentor@test.dev');

        await setupCloudEnvironment({
          cwd: tmpDir,
          port,
          env: { NEXT_PUBLIC_API_URL: 'https://custom.xtalent.dev/api' },
        });
        const overriddenDevEnv = fs.readFileSync(
          path.join(tmpDir, '.env.development.local'),
          'utf8'
        );
        expect(overriddenDevEnv).toContain(
          'NEXT_PUBLIC_API_URL=https://custom.xtalent.dev/api'
        );
        expect(overriddenDevEnv).not.toContain('BFF_OPENAPI_URL=');
        expect(overriddenDevEnv).toContain(
          'DESIGN_AUDIT_MENTOR_EMAIL=mentor@test.dev'
        );

        const updatedGitignore = fs.readFileSync(
          path.join(tmpDir, '.gitignore'),
          'utf8'
        );
        expect(updatedGitignore).not.toContain('/.agents/tmp/');
        expect(updatedGitignore).toContain('node_modules/');

        const updatedSettings = JSON.parse(
          fs.readFileSync(
            path.join(tmpDir, '.gemini', 'settings.json'),
            'utf8'
          )
        );
        expect(updatedSettings.mcpServers).toBeUndefined();
        expect(updatedSettings.hooks).toBeUndefined();
        expect(updatedSettings.tools.exclude).toEqual([
          'custom_dangerous_tool',
          'web_fetch',
          'run_shell_command',
          'google_web_search',
        ]);

        const infoExclude = fs.readFileSync(
          path.join(tmpDir, '.git', 'info', 'exclude'),
          'utf8'
        );
        expect(
          infoExclude
            .split(LF)
            .filter((line) => line === '.env.development.local')
        ).toHaveLength(1);
        expect(infoExclude).not.toContain('.agents/tmp');

        expect(
          fs.existsSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'))
        ).toBe(true);
        expect(
          gitCalls.some(
            (args) =>
              args[0] === 'update-index' &&
              args[1] === '--skip-worktree' &&
              args[2] === '.gemini/settings.json'
          )
        ).toBe(true);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('returns false from mergeHeadlessGeminiSettings on missing or invalid JSON', () => {
      expect(
        mergeHeadlessGeminiSettings('missing.json', { existsSync: () => false })
      ).toBe(false);
      expect(
        mergeHeadlessGeminiSettings('array.json', {
          existsSync: () => true,
          readFileSync: () => '[]',
        })
      ).toBe(false);
    });
  });

  describe('applyDeleteFilesManifest sandbox rules', () => {
    it('deletes normal repo files while rejecting .gemini, .gitignore, .agents, .git, .env*, traversal, directories, and symlinks', () => {
      const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-guard-del-'));
      try {
        fs.mkdirSync(path.join(tmpRepo, '.agents', 'tmp'), { recursive: true });
        fs.mkdirSync(path.join(tmpRepo, '.agents', 'scripts'), {
          recursive: true,
        });
        fs.mkdirSync(path.join(tmpRepo, '.gemini'), { recursive: true });
        fs.mkdirSync(path.join(tmpRepo, '.git'), { recursive: true });
        fs.mkdirSync(path.join(tmpRepo, 'src', 'keep-dir'), {
          recursive: true,
        });

        const deletableFile = path.join(tmpRepo, 'src', 'obsolete.ts');
        const gitignoreFile = path.join(tmpRepo, '.gitignore');
        const geminiFile = path.join(tmpRepo, '.gemini', 'settings.json');
        const agentScript = path.join(
          tmpRepo,
          '.agents',
          'scripts',
          'tracker-ops.mjs'
        );
        const gitHead = path.join(tmpRepo, '.git', 'HEAD');
        const envLocal = path.join(tmpRepo, '.env.local');
        const envExample = path.join(tmpRepo, '.env.example');
        const realTarget = path.join(tmpRepo, 'src', 'real-target.ts');
        const symlinkTarget = path.join(tmpRepo, 'src', 'sym-target.ts');

        fs.writeFileSync(deletableFile, 'export const old = 1;', 'utf8');
        fs.writeFileSync(gitignoreFile, 'node_modules/', 'utf8');
        fs.writeFileSync(geminiFile, '{}', 'utf8');
        fs.writeFileSync(agentScript, 'export {};', 'utf8');
        fs.writeFileSync(gitHead, 'ref: refs/heads/develop', 'utf8');
        fs.writeFileSync(envLocal, 'SECRET=1', 'utf8');
        fs.writeFileSync(envExample, 'EXAMPLE=1', 'utf8');
        fs.writeFileSync(realTarget, 'export const keep = true;', 'utf8');

        let createdSymlink = false;
        try {
          fs.symlinkSync(realTarget, symlinkTarget);
          createdSymlink = true;
        } catch {
          // Symlink creation may require privileges on restricted Windows hosts
        }

        const manifestPath = path.join(
          tmpRepo,
          '.agents',
          'tmp',
          'delete-files.txt'
        );
        const entries = [
          'src/obsolete.ts',
          '.gitignore',
          '.gemini/settings.json',
          '.agents/scripts/tracker-ops.mjs',
          '.git/HEAD',
          '.env.local',
          '.env.example',
          '../escape.txt',
          '/etc/passwd',
          `src/bad${NUL}.ts`,
          'src/keep-dir',
          ...(createdSymlink ? ['src/sym-target.ts'] : []),
        ];
        fs.writeFileSync(manifestPath, entries.join(LF), 'utf8');

        const res = applyDeleteFilesManifest({ cwd: tmpRepo });

        expect(res.deleted).toEqual(['src/obsolete.ts']);
        expect(fs.existsSync(deletableFile)).toBe(false);
        expect(fs.existsSync(manifestPath)).toBe(false);

        expect(fs.existsSync(gitignoreFile)).toBe(true);
        expect(fs.existsSync(geminiFile)).toBe(true);
        expect(fs.existsSync(agentScript)).toBe(true);
        expect(fs.existsSync(gitHead)).toBe(true);
        expect(fs.existsSync(envLocal)).toBe(true);
        expect(fs.existsSync(envExample)).toBe(true);
        expect(fs.existsSync(path.join(tmpRepo, 'src', 'keep-dir'))).toBe(true);
        expect(fs.existsSync(realTarget)).toBe(true);
        if (createdSymlink) {
          expect(fs.lstatSync(symlinkTarget).isSymbolicLink()).toBe(true);
        }
      } finally {
        fs.rmSync(tmpRepo, { recursive: true, force: true });
      }
    });
  });

  describe('runPreCommitSecretGuard & CLI dispatcher', () => {
    it('blocks staged secret .env files in pre-commit check while permitting .env.example', async () => {
      const stderrChunks = [];
      const blockedPort = {
        git: vi.fn((args) => {
          if (args[0] === 'diff') {
            return ['.env.development.local', '.env.example'].join(LF);
          }
          return '';
        }),
        gh: vi.fn(() => ''),
      };

      const cliBlocked = await runWorkspaceGuardCli(['pre-commit-check'], {
        cwd: '/repo',
        port: blockedPort,
        stderr: { write: (msg) => stderrChunks.push(msg) },
      });
      expect(cliBlocked.exitCode).toBe(1);
      expect(stderrChunks.join('')).toContain('Blocked staging of secret .env');

      const cleanPort = {
        git: vi.fn((args) => {
          if (args[0] === 'diff') {
            return ['.env.example', '.env.template', 'src/app.tsx'].join(LF);
          }
          return '';
        }),
        gh: vi.fn(() => ''),
      };
      const guardClean = runPreCommitSecretGuard({
        cwd: '/repo',
        port: cleanPort,
      });
      expect(guardClean.blocked).toBe(false);
    });
  });
});
