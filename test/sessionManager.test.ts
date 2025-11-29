import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';

// Mock child_process and fs before importing sessionManager
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

// Import after mocking
const { sessionManager, setAllowedPaths } = await import('../src/sessionManager.js');

describe('SessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset internal state by clearing maps through the public API
    // We'll test with fresh state each time
  });

  describe('checkTmux', () => {
    it('should return true when tmux is installed', () => {
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from('/usr/bin/tmux'));
      expect(sessionManager.checkTmux()).toBe(true);
    });

    it('should return false when tmux is not installed', () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('command not found');
      });
      expect(sessionManager.checkTmux()).toBe(false);
    });
  });

  describe('getTmuxName', () => {
    it('should prefix session ID with "claude-"', () => {
      expect(sessionManager.getTmuxName('myproject')).toBe('claude-myproject');
    });
  });

  describe('sessionExists', () => {
    it('should return true when session exists', () => {
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from(''));
      expect(sessionManager.sessionExists('test')).toBe(true);
    });

    it('should return false when session does not exist', () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('session not found');
      });
      expect(sessionManager.sessionExists('nonexistent')).toBe(false);
    });
  });

  describe('createSession', () => {
    it('should create a new tmux session', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync)
        .mockImplementationOnce(() => { throw new Error('no session'); }); // sessionExists check
      vi.mocked(spawnSync).mockReturnValueOnce({ status: 0 } as any); // tmux new-session

      const result = await sessionManager.createSession('test', '/tmp', 'channel123');

      expect(result).toMatchObject({
        id: 'test',
        tmuxName: 'claude-test',
        directory: '/tmp',
        channelId: 'channel123',
        attachCommand: 'tmux attach -t claude-test',
      });
    });

    it('should throw if directory does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(
        sessionManager.createSession('test', '/nonexistent', 'channel123')
      ).rejects.toThrow('Directory does not exist');
    });

    it('should throw if session already exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from('')); // sessionExists returns true

      await expect(
        sessionManager.createSession('test', '/tmp', 'channel123')
      ).rejects.toThrow('already exists');
    });

    it('should expand ~ to home directory', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync)
        .mockImplementationOnce(() => { throw new Error('no session'); }); // sessionExists check
      vi.mocked(spawnSync).mockReturnValueOnce({ status: 0 } as any); // tmux new-session

      const result = await sessionManager.createSession('test2', '~/projects', 'channel123');

      expect(result.directory).not.toContain('~');
      expect(result.directory).toMatch(/^\/.*projects$/);
    });
  });

  describe('linkChannel', () => {
    it('should link a session to a channel', () => {
      sessionManager.linkChannel('test-session', 'channel-456');
      expect(sessionManager.getChannelBySession('test-session')).toBe('channel-456');
      expect(sessionManager.getSessionByChannel('channel-456')).toBe('test-session');
    });
  });

  describe('getSessionByChannel', () => {
    it('should return session ID for linked channel', () => {
      sessionManager.linkChannel('my-session', 'my-channel');
      expect(sessionManager.getSessionByChannel('my-channel')).toBe('my-session');
    });

    it('should return undefined for unlinked channel', () => {
      expect(sessionManager.getSessionByChannel('unknown-channel')).toBeUndefined();
    });
  });

  describe('unlinkChannel', () => {
    it('should remove channel mapping', () => {
      sessionManager.linkChannel('session-x', 'channel-x');
      expect(sessionManager.getSessionByChannel('channel-x')).toBe('session-x');

      sessionManager.unlinkChannel('channel-x');
      expect(sessionManager.getSessionByChannel('channel-x')).toBeUndefined();
      expect(sessionManager.getChannelBySession('session-x')).toBeUndefined();
    });
  });

  describe('listSessions', () => {
    it('should parse tmux list-sessions output', () => {
      const mockOutput = 'claude-project1|1700000000|/home/user/project1\nclaude-project2|1700000001|/home/user/project2';
      vi.mocked(execSync).mockReturnValueOnce(mockOutput as unknown as Buffer);

      const sessions = sessionManager.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toMatchObject({
        id: 'project1',
        tmuxName: 'claude-project1',
        directory: '/home/user/project1',
      });
      expect(sessions[1]).toMatchObject({
        id: 'project2',
        tmuxName: 'claude-project2',
        directory: '/home/user/project2',
      });
    });

    it('should filter out non-claude sessions', () => {
      const mockOutput = 'claude-myproject|1700000000|/tmp\nother-session|1700000001|/home';
      vi.mocked(execSync).mockReturnValueOnce(mockOutput as unknown as Buffer);

      const sessions = sessionManager.listSessions();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('myproject');
    });

    it('should return empty array on error', () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('tmux error');
      });

      expect(sessionManager.listSessions()).toEqual([]);
    });
  });

  describe('sendToSession', () => {
    it('should send keys to tmux session', async () => {
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from('')) // sessionExists
        .mockReturnValueOnce(Buffer.from('')) // send-keys -l
        .mockReturnValueOnce(Buffer.from('')); // send-keys Enter

      await sessionManager.sendToSession('test', 'hello world');

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('send-keys'),
        expect.any(Object)
      );
    });

    it('should throw if session does not exist', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('no session');
      });

      await expect(
        sessionManager.sendToSession('nonexistent', 'hello')
      ).rejects.toThrow('does not exist');
    });

    it('should escape single quotes in text', async () => {
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from(''))
        .mockReturnValueOnce(Buffer.from(''))
        .mockReturnValueOnce(Buffer.from(''));

      await sessionManager.sendToSession('test', "it's a test");

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining("'\\''"),
        expect.any(Object)
      );
    });
  });

  describe('captureOutput', () => {
    it('should capture pane output with ANSI codes', () => {
      const mockOutput = '\x1b[32mGreen text\x1b[0m\nMore content';
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from('')) // sessionExists
        .mockReturnValueOnce(mockOutput as unknown as Buffer); // capture-pane (returns string with encoding)

      const output = sessionManager.captureOutput('test', 100);

      expect(output).toBe(mockOutput);
    });

    it('should throw if session does not exist', () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('no session');
      });

      expect(() => sessionManager.captureOutput('nonexistent')).toThrow('does not exist');
    });
  });

  describe('sendEscape', () => {
    it('should send Escape key to session', async () => {
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from('')) // sessionExists
        .mockReturnValueOnce(Buffer.from('')); // send-keys Escape

      const result = await sessionManager.sendEscape('test');

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('Escape'),
        expect.any(Object)
      );
    });
  });

  describe('killSession', () => {
    it('should kill tmux session and clean up mappings', async () => {
      // Setup: create a linked session
      sessionManager.linkChannel('kill-test', 'kill-channel');

      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from('')) // sessionExists
        .mockReturnValueOnce(Buffer.from('')); // kill-session

      const result = await sessionManager.killSession('kill-test');

      expect(result).toBe(true);
      expect(sessionManager.getChannelBySession('kill-test')).toBeUndefined();
      expect(sessionManager.getSessionByChannel('kill-channel')).toBeUndefined();
    });

    it('should throw if session does not exist', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('no session');
      });

      await expect(sessionManager.killSession('nonexistent')).rejects.toThrow('does not exist');
    });
  });

  describe('getSession', () => {
    it('should return session info', () => {
      const mockOutput = 'claude-info-test|1700000000|/home/user/project';
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from('')) // sessionExists
        .mockReturnValueOnce(mockOutput as unknown as Buffer); // list-sessions (returns string with encoding)

      const session = sessionManager.getSession('info-test');

      expect(session).toMatchObject({
        id: 'info-test',
        tmuxName: 'claude-info-test',
        directory: '/home/user/project',
      });
    });

    it('should return null if session does not exist', () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('no session');
      });

      expect(sessionManager.getSession('nonexistent')).toBeNull();
    });
  });

  // Security tests
  describe('Security: Path Restrictions', () => {
    afterEach(() => {
      // Reset allowed paths after each test
      setAllowedPaths([]);
    });

    it('should allow any path when no restrictions set', async () => {
      setAllowedPaths([]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockImplementationOnce(() => { throw new Error('no session'); });
      vi.mocked(spawnSync).mockReturnValueOnce({ status: 0 } as any);

      const result = await sessionManager.createSession('unrestricted', '/any/path', 'channel1');
      expect(result.directory).toBe('/any/path');
    });

    it('should reject paths outside allowed directories', async () => {
      setAllowedPaths(['/home/user/projects']);
      vi.mocked(existsSync).mockReturnValue(true);

      await expect(
        sessionManager.createSession('blocked', '/etc/passwd', 'channel1')
      ).rejects.toThrow('Directory not in allowed paths');
    });

    it('should allow paths inside allowed directories', async () => {
      setAllowedPaths(['/home/user/projects']);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockImplementationOnce(() => { throw new Error('no session'); });
      vi.mocked(spawnSync).mockReturnValueOnce({ status: 0 } as any);

      const result = await sessionManager.createSession('allowed', '/home/user/projects/myapp', 'channel1');
      expect(result.directory).toBe('/home/user/projects/myapp');
    });

    it('should allow exact match of allowed directory', async () => {
      setAllowedPaths(['/home/user/projects']);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockImplementationOnce(() => { throw new Error('no session'); });
      vi.mocked(spawnSync).mockReturnValueOnce({ status: 0 } as any);

      const result = await sessionManager.createSession('exact', '/home/user/projects', 'channel1');
      expect(result.directory).toBe('/home/user/projects');
    });

    it('should reject path that starts with allowed path but is not a subdirectory', async () => {
      setAllowedPaths(['/home/user/projects']);
      vi.mocked(existsSync).mockReturnValue(true);

      // /home/user/projects-evil starts with /home/user/projects but is not inside it
      await expect(
        sessionManager.createSession('sneaky', '/home/user/projects-evil', 'channel1')
      ).rejects.toThrow('Directory not in allowed paths');
    });

    it('should support multiple allowed paths', async () => {
      setAllowedPaths(['/home/user/projects', '/var/www']);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockImplementation(() => { throw new Error('no session'); });
      vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

      const result1 = await sessionManager.createSession('multi1', '/home/user/projects/app1', 'ch1');
      expect(result1.directory).toBe('/home/user/projects/app1');

      const result2 = await sessionManager.createSession('multi2', '/var/www/site', 'ch2');
      expect(result2.directory).toBe('/var/www/site');
    });
  });

  describe('Security: Command Injection Prevention', () => {
    it('should use spawnSync with argument array (not string interpolation)', async () => {
      setAllowedPaths([]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockImplementationOnce(() => { throw new Error('no session'); });
      vi.mocked(spawnSync).mockReturnValueOnce({ status: 0 } as any);

      await sessionManager.createSession('safe', '/tmp/test', 'channel1');

      // Verify spawnSync was called with separate arguments (safe)
      // NOT with a single interpolated string (vulnerable)
      expect(spawnSync).toHaveBeenCalledWith(
        'tmux',
        ['new-session', '-d', '-s', 'claude-safe', '-c', '/tmp/test', 'claude'],
        expect.any(Object)
      );
    });

    it('should not allow shell metacharacters to escape via directory path', async () => {
      setAllowedPaths(['/tmp']);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockImplementationOnce(() => { throw new Error('no session'); });
      vi.mocked(spawnSync).mockReturnValueOnce({ status: 0 } as any);

      // This malicious path would execute `rm -rf /` if interpolated into a shell command
      const maliciousPath = '/tmp/$(whoami)';
      await sessionManager.createSession('inject', maliciousPath, 'channel1');

      // With spawnSync argument array, the path is passed as a single argument
      // The shell metacharacters are NOT interpreted
      expect(spawnSync).toHaveBeenCalledWith(
        'tmux',
        ['new-session', '-d', '-s', 'claude-inject', '-c', maliciousPath, 'claude'],
        expect.any(Object)
      );
    });
  });
});
