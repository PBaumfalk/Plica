import { describe, expect, it } from "vitest";
import { greetingName } from "@/lib/names";

describe("greetingName", () => {
  it("nimmt den Vornamen", () => expect(greetingName("Lena Muster")).toBe("Lena"));
  it("überspringt akademische Titel", () => {
    expect(greetingName("Dr. Anna Beispiel")).toBe("Anna");
    expect(greetingName("Prof. Dr. jur. Max Mustermann")).toBe("Max");
    expect(greetingName("Dipl.-Jur. Eva Test")).toBe("Eva");
  });
  it("fällt auf den ganzen Namen zurück, wenn nur Titel und Nachname da sind", () => expect(greetingName("Dr. Beispiel")).toBe("Beispiel"));
  it("verträgt Leerzeichen und leere Namen", () => {
    expect(greetingName("  Erika   Mustermann ")).toBe("Erika");
    expect(greetingName("")).toBe("");
  });
});
