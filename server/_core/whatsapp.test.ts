import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeBrazilPhone, sendAccessWhatsApp } from "./whatsapp";

const config = {
  whatsappToken: "token",
  whatsappPhoneNumberId: "123456",
  whatsappAccessTemplate: "acesso_portal",
  whatsappTemplateLanguage: "pt_BR",
  whatsappApiVersion: "v23.0",
};

afterEach(() => vi.unstubAllGlobals());

describe("normalizeBrazilPhone", () => {
  it("accepts the formats the team types", () => {
    expect(normalizeBrazilPhone("(31) 99538-6202")).toBe("5531995386202");
    expect(normalizeBrazilPhone("31 99538 6202")).toBe("5531995386202");
    expect(normalizeBrazilPhone("+55 63 99276-2023")).toBe("5563992762023");
    expect(normalizeBrazilPhone("62981313765")).toBe("5562981313765");
    expect(normalizeBrazilPhone("(41) 9218-0655")).toBe("554192180655");
  });

  it("rejects what cannot be a Brazilian number", () => {
    expect(normalizeBrazilPhone("")).toBeNull();
    expect(normalizeBrazilPhone("99538-6202")).toBeNull();
    expect(normalizeBrazilPhone(undefined)).toBeNull();
  });
});

describe("sendAccessWhatsApp", () => {
  it("sends the approved template with first name and link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await sendAccessWhatsApp("5531995386202", { firstName: "Joana", link: "https://portal/primeiro-acesso?u=a&t=b" }, config);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v23.0/123456/messages");
    const body = JSON.parse(init.body);
    expect(body.to).toBe("5531995386202");
    expect(body.template.name).toBe("acesso_portal");
    expect(body.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual(["Joana", "https://portal/primeiro-acesso?u=a&t=b"]);
  });

  it("explains an unapproved template", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: { code: 132001, message: "Template name does not exist" } }) }));
    await expect(sendAccessWhatsApp("5531995386202", { firstName: "Joana", link: "x" }, config)).rejects.toThrow("não foi aprovado");
  });
});
