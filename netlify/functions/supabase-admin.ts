import {
  deleteSupabaseUserAccountAdmin,
  getSupabaseStatusPayload,
  inviteWorkspaceMemberAdmin,
  onboardSupabaseUserAdmin,
  seedDemoWorkspaceAdmin,
  verifySupabaseAccessToken,
} from '../../server/supabaseAdmin.ts';

function normalizeSubpath(pathname: string): string {
  if (pathname.startsWith('/api/supabase')) {
    return pathname.slice('/api/supabase'.length) || '/';
  }
  if (pathname.startsWith('/.netlify/functions/supabase-admin')) {
    return pathname.slice('/.netlify/functions/supabase-admin'.length) || '/';
  }
  return pathname;
}

async function parseJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    if (!text) return {};
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const subpath = normalizeSubpath(url.pathname);
  const method = req.method.toUpperCase();

  if (subpath === '/status' && method === 'GET') {
    return Response.json(getSupabaseStatusPayload(), { status: 200 });
  }

  if (subpath === '/seed-demo' && method === 'POST') {
    const result = await seedDemoWorkspaceAdmin();
    return Response.json(result.data, { status: result.status });
  }

  const verified = await verifySupabaseAccessToken(req.headers.get('authorization'));
  if ('error' in verified) {
    return Response.json({ error: verified.error }, { status: verified.errorStatus });
  }

  if (subpath === '/onboarding' && method === 'POST') {
    const body = await parseJsonBody(req);
    const result = await onboardSupabaseUserAdmin(verified.admin, verified.user, body);
    return Response.json(result.data, { status: result.status });
  }

  const inviteMatch = subpath.match(/^\/workspaces\/([^/]+)\/invitations$/);
  if (inviteMatch && method === 'POST') {
    const body = await parseJsonBody(req);
    const result = await inviteWorkspaceMemberAdmin(verified.admin, verified.user.id, decodeURIComponent(inviteMatch[1]), body);
    return Response.json(result.data, { status: result.status });
  }

  if (subpath === '/account' && method === 'DELETE') {
    const result = await deleteSupabaseUserAccountAdmin(verified.admin, verified.user.id);
    return Response.json(result.data, { status: result.status });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
};
