import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: [] as { id: string; email: string; app_metadata: Record<string, unknown> }[],
  clienteIds: [] as number[],
  clientesError: null as { message: string } | null,
  deleted: [] as string[],
}));

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: state.users }, error: null }),
        deleteUser: async (id: string) => {
          state.deleted.push(id);
          return { error: null };
        },
      },
    },
    from: () => ({
      select: () => ({
        in: async (_column: string, ids: number[]) => ({
          data: state.clientesError ? null : ids.filter((id) => state.clienteIds.includes(id)).map((id) => ({ id })),
          error: state.clientesError,
        }),
      }),
    }),
  },
}));

const { removeOrphanClientLogins } = await import("./clientAccess");

beforeEach(() => {
  state.users = [
    { id: "kept", email: "ana@x.com", app_metadata: { role: "client", cliente_id: 1 } },
    { id: "orphan", email: "apagado@x.com", app_metadata: { role: "client", cliente_id: 2 } },
    { id: "team", email: "equipe@x.com", app_metadata: { role: "staff" } },
  ];
  state.clienteIds = [1];
  state.clientesError = null;
  state.deleted = [];
});

describe("removeOrphanClientLogins", () => {
  it("removes only client logins whose cliente row is gone", async () => {
    expect(await removeOrphanClientLogins()).toEqual(["apagado@x.com"]);
    expect(state.deleted).toEqual(["orphan"]);
  });

  it("removes nothing when the clients cannot be read", async () => {
    state.clientesError = { message: "connection lost" };
    await expect(removeOrphanClientLogins()).rejects.toBeTruthy();
    expect(state.deleted).toEqual([]);
  });
});
