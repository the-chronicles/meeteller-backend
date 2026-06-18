import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import OpenAI from 'openai';
import { TranscriptSegment } from '../transcripts/transcript-segment.entity';
import { Meeting } from '../meetings/meeting.entity';
import { WorkspaceMember } from '../workspaces/workspace-member.entity';

@Injectable()
export class SearchService {
  private readonly openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
  });

  private readonly groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || 'dummy-key',
    baseURL: 'https://api.groq.com/openai/v1',
  });

  constructor(
    @InjectRepository(TranscriptSegment)
    private readonly segmentRepo: Repository<TranscriptSegment>,
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepo: Repository<WorkspaceMember>,
    private readonly dataSource: DataSource,
  ) {}

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });
    return response.data[0].embedding;
  }

  async generateAndSaveEmbedding(segmentId: number): Promise<void> {
    const segment = await this.segmentRepo.findOne({ where: { id: segmentId } });
    if (!segment) {
      return;
    }

    try {
      const embedding = await this.generateEmbedding(segment.text);
      segment.embedding = embedding;
      await this.segmentRepo.save(segment);
      console.log(`Generated and saved embedding for segment ${segmentId}`);
    } catch (error) {
      console.error(`Error generating embedding for segment ${segmentId}:`, error);
    }
  }

  async semanticSearch(
    userId: number,
    query: string,
    options: { meetingId?: number; workspaceId?: number; limit?: number } = {},
  ) {
    const limit = options.limit || 5;
    const queryEmbedding = await this.generateEmbedding(query);

    // Format SQL parameter: convert float[] to a string formatted as '[1.2,3.4,...]'
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    let sql = `
      SELECT segment.id, segment.text, segment.speaker, segment."startTime", segment."endTime",
             m.id AS "meetingId", m.title AS "meetingTitle",
             (segment.embedding <=> $1::vector) AS distance
      FROM transcript_segment segment
      INNER JOIN transcript t ON segment."transcriptId" = t.id
      INNER JOIN meeting m ON t."meetingId" = m.id
      LEFT JOIN workspace_member wm ON m."workspaceId" = wm."workspaceId" AND wm."userId" = $2
      WHERE segment.embedding IS NOT NULL
        AND (m."ownerId" = $2 OR wm.id IS NOT NULL)
    `;

    const params: any[] = [embeddingString, userId];

    if (options.meetingId) {
      sql += ` AND m.id = $3`;
      params.push(options.meetingId);
    } else if (options.workspaceId) {
      sql += ` AND m."workspaceId" = $3`;
      params.push(options.workspaceId);
    }

    sql += ` ORDER BY distance ASC LIMIT $${params.length + 1}`;
    params.push(limit);

    const results = await this.dataSource.query(sql, params);

    return results.map((r) => ({
      id: r.id,
      text: r.text,
      speaker: r.speaker,
      startTime: r.startTime,
      endTime: r.endTime,
      meeting: {
        id: r.meetingId,
        title: r.meetingTitle,
      },
      similarity: 1 - Number(r.distance), // Cosine similarity = 1 - Cosine distance
    }));
  }

  async aiChat(userId: number, question: string, meetingId: number): Promise<string> {
    // 1. Verify access to meeting
    const meeting = await this.meetingRepo.findOne({
      where: { id: meetingId },
      relations: ['owner', 'workspace'],
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const isOwner = meeting.owner.id === userId;
    let isWorkspaceMember = false;

    if (meeting.workspace) {
      const membership = await this.memberRepo.findOne({
        where: { workspace: { id: meeting.workspace.id }, user: { id: userId } },
      });
      isWorkspaceMember = !!membership;
    }

    if (!isOwner && !isWorkspaceMember) {
      throw new ForbiddenException('You do not have access to this meeting');
    }

    // 2. Retrieve top relevant segments via semantic search
    const results = await this.semanticSearch(userId, question, { meetingId, limit: 5 });

    if (results.length === 0) {
      return 'No transcription context available for this meeting.';
    }

    // 3. Compile context
    const context = results
      .map((r) => `[Speaker: ${r.speaker || 'Unknown'}]: ${r.text}`)
      .join('\n');

    // 4. Invoke LLM with system instructions
    const response = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `
You are an AI meeting assistant. Answer the user's question about the meeting using ONLY the transcript segments provided below as context.

If the answer cannot be found in the context segments, state: "I cannot find the answer in the transcript of this meeting." Do not make up answers or use external knowledge.

Context:
${context}
`,
        },
        {
          role: 'user',
          content: question,
        },
      ],
      temperature: 0.1,
    });

    return response.choices[0].message.content || 'No answer generated.';
  }
}
