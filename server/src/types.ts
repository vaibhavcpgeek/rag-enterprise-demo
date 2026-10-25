export type UserContext = { id: string; tenantId: string; groups: string[]; roles: string[] };
export type Chunk = {
  id: string; documentId: string; title: string; content: string; sourceUrl: string;
  page?: number; section?: string; department: string; tenantId: string;
  accessGroups: string[]; version: number; score?: number; rank?: number;
};
export type Citation = { sourceId: string; title: string; url: string; page?: number; quote: string };
export type ChatResponse = {
  answer: string; citations: Citation[]; requestId: string; insufficientEvidence: boolean;
  route: string[]; timingsMs: Record<string, number>; warnings: string[];
};
