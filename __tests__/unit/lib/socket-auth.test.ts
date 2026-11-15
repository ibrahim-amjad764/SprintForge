// __tests__/unit/lib/socket-auth.test.ts
//
// Verifies server/socket.ts authentication middleware and room
// authorization without a real Socket.IO server.

const mockUse = jest.fn();
const mockOn = jest.fn();
const mockJoin = jest.fn();
const mockLeave = jest.fn();

jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => ({
    use: mockUse,
    on: mockOn,
  })),
}));

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

const mockMemberFindOne = jest.fn();
const mockWorkspaceFindById = jest.fn();
const mockProjectFindById = jest.fn();

jest.mock('@/models/WorkspaceMember', () => ({
  __esModule: true,
  default: {
    findOne: (...args: unknown[]) => mockMemberFindOne(...args),
    find: jest.fn(),
  },
}));

jest.mock('@/models/Workspace', () => ({
  __esModule: true,
  default: {
    findById: (...args: unknown[]) => mockWorkspaceFindById(...args),
    find: jest.fn(),
  },
}));

jest.mock('@/models/Project', () => ({
  __esModule: true,
  default: {
    findById: (...args: unknown[]) => mockProjectFindById(...args),
    find: jest.fn(),
  },
}));

jest.mock('@/models/Task', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock('@/models/Team', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

type Middleware = (
  socket: ReturnType<typeof fakeSocket>,
  next: (err?: Error) => void,
) => Promise<void>;
type ConnectionHandler = (socket: {
  userId: string;
  join: jest.Mock;
  leave: jest.Mock;
  on: (event: string, handler: (arg: string) => Promise<void>) => void;
}) => void;

let middleware: Middleware;
let connectionHandler: ConnectionHandler;
let mockJwtVerify: jest.Mock;
let roomHandlers: Record<string, (arg: string) => Promise<void>>;

function fakeSocket(handshake: {
  auth?: Record<string, unknown>;
  headers?: Record<string, string>;
}) {
  return {
    handshake,
    userId: undefined as string | undefined,
    join: mockJoin,
    leave: mockLeave,
  };
}

function chain(result: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
    populate: jest.fn().mockReturnThis(),
  };
}

beforeAll(async () => {
  const socketModule = await import('@/server/socket');
  socketModule.initSocket({} as never);

  const jose = await import('jose');
  mockJwtVerify = jose.jwtVerify as unknown as jest.Mock;

  // Capture registered middleware and connection handler once —
  // jest.clearAllMocks() in beforeEach wipes mock.calls.
  middleware = mockUse.mock.calls[0][0] as Middleware;
  const connCall = mockOn.mock.calls.find((c) => c[0] === 'connection');
  connectionHandler = connCall![1] as ConnectionHandler;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockJwtVerify.mockResolvedValue({ payload: { userId: 'user-1' } });

  roomHandlers = {};
  const fakeSock = {
    userId: 'user-1',
    join: mockJoin,
    leave: mockLeave,
    on: (event: string, handler: (arg: string) => Promise<void>) => {
      roomHandlers[event] = handler;
    },
  };
  connectionHandler(fakeSock);
});

describe('Socket.IO authentication', () => {
  it('rejects connections with no token', async () => {
    const sock = fakeSocket({ auth: {}, headers: {} });
    const next = jest.fn();
    await middleware(sock, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(sock.userId).toBeUndefined();
  });

  it('rejects invalid tokens', async () => {
    mockJwtVerify.mockResolvedValue(null);
    const sock = fakeSocket({ auth: { token: 'bad' }, headers: {} });
    const next = jest.fn();
    await middleware(sock, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('accepts token from auth payload and sets userId', async () => {
    const sock = fakeSocket({ auth: { token: 'good' }, headers: {} });
    const next = jest.fn();
    await middleware(sock, next);
    expect(next).toHaveBeenCalledWith();
    expect(sock.userId).toBe('user-1');
  });

  it('accepts token from HttpOnly cookie header', async () => {
    const sock = fakeSocket({
      auth: {},
      headers: { cookie: 'other=1; token=jwt-from-cookie; theme=dark' },
    });
    const next = jest.fn();
    await middleware(sock, next);
    expect(next).toHaveBeenCalledWith();
    expect(sock.userId).toBe('user-1');
    expect(mockJwtVerify).toHaveBeenCalledWith('jwt-from-cookie', expect.anything());
  });
});

describe('Socket.IO room authorization', () => {
  it('joins user room on connect', () => {
    expect(mockJoin).toHaveBeenCalledWith('user:user-1');
  });

  it('allows join-workspace for a member', async () => {
    mockMemberFindOne.mockReturnValue(chain({ role: 'EDITOR' }));
    await roomHandlers['join-workspace']('ws-1');
    expect(mockJoin).toHaveBeenCalledWith('workspace:ws-1');
  });

  it('denies join-workspace for a non-member', async () => {
    mockMemberFindOne.mockReturnValue(chain(null));
    mockWorkspaceFindById.mockReturnValue(chain({ owner: 'other-user' }));
    await roomHandlers['join-workspace']('ws-x');
    expect(mockJoin).not.toHaveBeenCalledWith('workspace:ws-x');
  });

  it('denies join-project for a project in an inaccessible workspace', async () => {
    mockProjectFindById.mockReturnValue(chain({ workspace: 'ws-x' }));
    mockMemberFindOne.mockReturnValue(chain(null));
    mockWorkspaceFindById.mockReturnValue(chain({ owner: 'other-user' }));
    await roomHandlers['join-project']('proj-1');
    expect(mockJoin).not.toHaveBeenCalledWith('project:proj-1');
  });

  it('allows join-project for an accessible project', async () => {
    mockProjectFindById.mockReturnValue(chain({ workspace: 'ws-1' }));
    mockMemberFindOne.mockReturnValue(chain({ role: 'VIEWER' }));
    await roomHandlers['join-project']('proj-1');
    expect(mockJoin).toHaveBeenCalledWith('project:proj-1');
  });
});
