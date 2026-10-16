import { describe, expect, it } from "vitest";
import { pushText } from "./notificacoes";

describe("pushText", () => {
  it("opens the chat for a reply and the portal for the rest", () => {
    expect(pushText("resposta").url).toBe("/?aba=conversa");
    expect(pushText("status", "Concluído").url).toBe("/");
  });

  it("says what changed without the client's name (it shows on the lock screen)", () => {
    expect(pushText("status", "Concluído")).toMatchObject({ title: "Seu processo foi atualizado", body: "Situação atual: Concluído.", tag: "status" });
    expect(pushText("documento", "Contrato.pdf").body).toBe("A N1 adicionou: Contrato.pdf.");
    expect(pushText("documento").body).toBe("A N1 adicionou um documento ao seu processo.");
  });
});
