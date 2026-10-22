/**
 * OpenAPI 3.1 – von Hand gepflegt. Ein Test stellt sicher, dass jede
 * Route unter src/app/api/v1 hier dokumentiert ist.
 */
const err = { $ref: "#/components/responses/Error" };
const idParam = (name: string, desc: string) => ({ name, in: "path", required: true, description: desc, schema: { type: "string" } });

export const OPENAPI = {
  openapi: "3.1.0",
  info: {
    title: "PLICA API",
    version: "1.0.0",
    description:
      "REST-API für Formulare und Antworten eines Workspace. Authentifizierung per `Authorization: Bearer plc_…`. Wirksame Rechte = Scope des Schlüssels (read/write) ∩ Rolle des Besitzers. Fehler: `{ \"error\": { \"code\", \"message\" } }`. Limit: 600 Anfragen pro Minute und Schlüssel.",
  },
  servers: [{ url: "/api/v1" }],
  security: [{ bearer: [] }],
  paths: {
    "/forms": {
      get: { summary: "Formulare auflisten", "x-permission": "forms.read", "x-scope": "read", responses: { 200: { description: "Liste", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/FormSummary" } } } } } } }, 401: err } },
    },
    "/forms/{id}": {
      get: { summary: "Formular mit veröffentlichter Definition", "x-permission": "forms.read", "x-scope": "read", parameters: [idParam("id", "Formular-ID")], responses: { 200: { description: "Formular" }, 404: err } },
    },
    "/forms/{id}/submissions": {
      get: {
        summary: "Antworten eines Formulars (älteste zuerst, Cursor-Paginierung)",
        "x-permission": "submissions.read",
        "x-scope": "read",
        parameters: [
          idParam("id", "Formular-ID"),
          { name: "since", in: "query", schema: { type: "string", format: "date-time" }, description: "Nur Antworten ab diesem Zeitpunkt" },
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/Status" } },
          { name: "cursor", in: "query", schema: { type: "string" }, description: "Wert von `nextCursor` der vorherigen Seite" },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
        ],
        responses: { 200: { description: "Seite", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Submission" } }, nextCursor: { type: ["string", "null"] } } } } } }, 400: err, 404: err },
      },
    },
    "/submissions/{id}": {
      get: { summary: "Eine Antwort mit Dateiliste", "x-permission": "submissions.read", "x-scope": "read", parameters: [idParam("id", "Antwort-ID")], responses: { 200: { description: "Antwort", content: { "application/json": { schema: { $ref: "#/components/schemas/Submission" } } } }, 404: err } },
      patch: {
        summary: "Status oder Kennzeichnungen ändern (löst Workflows „Status geändert“ aus)",
        "x-permission": "submissions.update",
        "x-scope": "write",
        parameters: [idParam("id", "Antwort-ID")],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, properties: { status: { $ref: "#/components/schemas/Status" }, tags: { type: "array", items: { type: "string", maxLength: 40 }, maxItems: 30 } } } } } },
        responses: { 200: { description: "Aktualisierte Antwort" }, 400: err, 403: err, 404: err },
      },
    },
    "/submissions/{id}/pdf": {
      get: { summary: "Antwort als PDF", "x-permission": "submissions.read", "x-scope": "read", parameters: [idParam("id", "Antwort-ID")], responses: { 200: { description: "PDF", content: { "application/pdf": {} } }, 404: err } },
    },
    "/files/{id}": {
      get: {
        summary: "Hochgeladene Datei, Unterschrift oder erzeugtes PDF herunterladen",
        "x-permission": "submissions.read",
        "x-scope": "read",
        parameters: [idParam("id", "Datei-ID")],
        responses: { 200: { description: "Datei (Header `x-plica-sha256` mit Prüfsumme)" }, 404: err, 410: { description: "Als schädlich erkannt" }, 423: { description: "Ungeprüft in Quarantäne" } },
      },
    },
  },
  components: {
    securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "plc_…" } },
    responses: { Error: { description: "Fehler", content: { "application/json": { schema: { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } } } } } } } },
    schemas: {
      Status: { type: "string", enum: ["new", "in_review", "approved", "rejected", "done", "spam"] },
      FormSummary: { type: "object", properties: { id: { type: "string" }, slug: { type: "string" }, title: { type: "string" }, status: { type: "string" }, submissionCount: { type: "integer" }, createdAt: { type: "string" }, updatedAt: { type: "string" } } },
      Submission: {
        type: "object",
        properties: {
          id: { type: "string" },
          number: { type: "integer" },
          formId: { type: "string" },
          formVersion: { type: "integer" },
          status: { $ref: "#/components/schemas/Status" },
          tags: { type: "array", items: { type: "string" } },
          submittedAt: { type: "string", format: "date-time" },
          answers: { type: "object", description: "Rohwerte nach Feldschlüssel" },
          display: { type: "object", description: "Lesbare Texte nach Feldschlüssel" },
        },
      },
    },
  },
  "x-webhooks": {
    description: "Webhooks werden in Automationen konfiguriert. Header: X-Plica-Signature (t=…,v1=HMAC-SHA256(secret, t + '.' + body)), X-Plica-Delivery (gleich bei Wiederholungen), X-Plica-Event.",
  },
} as const;
