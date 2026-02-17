import { z } from 'zod';

export const FileAttachmentSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ]),
  data: z.string().min(1, 'File data is required'),
  sizeBytes: z.number().int().positive(),
});

export const ChatRequestSchema = z.object({
  conversationId: z.string().min(1),
  message: z.string().min(1).max(10000),
  attachment: FileAttachmentSchema.optional(),
  toolResults: z.array(z.object({
    toolCallId: z.string(),
    result: z.unknown(),
    isError: z.boolean(),
    errorMessage: z.string().optional(),
  })).optional(),
});

export type ValidatedChatRequest = z.infer<typeof ChatRequestSchema>;
